#!/usr/bin/env python3
"""
Задача автоматического управления статусами бронирований
"""

import asyncio
import httpx
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import logging
import traceback

logger = logging.getLogger(__name__)

from ..base_task import BaseTask


class BookingStatusAutomationTask(BaseTask):
    """
    Задача для автоматического управления статусами бронирований:
    1. BOOKED → PENDING_CONFIRMATION (за 60 минут до начала)
    2. Отправка push-уведомлений о необходимости подтверждения
    3. Автоматический переход в NO_SHOW при опоздании
    """
    
    def __init__(self, scheduler_instance=None, task_manager=None, settings=None):
        super().__init__(scheduler_instance, task_manager, settings)
        self.api_base_url = "http://server:8000/api/v1"
        self.task_name = "booking_status_automation"
        # Отслеживание отправленных уведомлений (booking_id -> set of sent notification types)
        self.sent_notifications = {}
        
    async def execute(self):
        """
        Выполняет автоматизацию статусов бронирований.
        Работает автономно, получая данные напрямую из API.
        """
        from zoneinfo import ZoneInfo
        
        current_time = datetime.now(timezone.utc)
        krasnoyarsk_time = current_time.astimezone(ZoneInfo("Asia/Krasnoyarsk"))
        
        logger.info("🤖 Запуск автоматизации статусов бронирований...")
        logger.info(f"⏰ Текущее время: {current_time.strftime('%H:%M:%S')} UTC / {krasnoyarsk_time.strftime('%H:%M:%S')} Красноярск")
        logger.info("🔄 Начинаем проверку и обновление статусов бронирований...")
        
        try:
            # Получаем все активные бронирования
            bookings = await self._get_active_bookings()
            if not bookings:
                logger.info("📭 Активных бронирований не найдено")
                return
            
            logger.info(f"📋 Найдено {len(bookings)} активных бронирований для проверки")
            
            # Счетчики для статистики
            updated_count = 0
            notifications_sent = 0
            
            # Обрабатываем каждое бронирование
            for booking in bookings:
                try:
                    booking_id = booking.get('id')
                    client_name = booking.get('client_name', 'Неизвестный клиент')
                    status = booking.get('status')
                    planned_start = booking.get('planned_start_time')
                    
                    logger.info(f"🔍 Проверяем бронирование #{booking_id}: {client_name}, статус: {status}, начало: {planned_start}")
                    
                    result = await self._process_booking(booking)
                    if result and result.get('updated'):
                        updated_count += 1
                        logger.info(f"✅ Бронирование #{booking_id} обновлено")
                    if result and result.get('notification_sent'):
                        notifications_sent += 1
                        logger.info(f"📤 Уведомление отправлено для бронирования #{booking_id}")
                        
                except Exception as e:
                    logger.error(f"❌ Ошибка при обработке бронирования {booking.get('id', 'N/A')}: {e}")
                    continue
            
            logger.info(f"✅ Автоматизация завершена: обновлено {updated_count} бронирований, отправлено {notifications_sent} уведомлений")
            
        except Exception as e:
            logger.error(f"❌ Критическая ошибка в автоматизации: {e}")
            logger.error(traceback.format_exc())
            raise
    
    async def _get_active_bookings(self) -> List[Dict[str, Any]]:
        """Получает активные бронирования из API"""
        try:
            # Получаем бронирования со статусами: booked, pending_confirmation, confirmed, in_use
            statuses = ["booked", "pending_confirmation", "confirmed", "in_use"]
            url = f"{self.api_base_url}/bookings/"  # Добавляем слеш в конце
            
            params = {
                "status": ",".join(statuses)
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=30)
                response.raise_for_status()
                
                bookings = response.json()
                logger.info(f"📋 Получено {len(bookings)} активных бронирований из API")
                return bookings
                
        except httpx.HTTPError as e:
            logger.error(f"Ошибка получения бронирований: {e}")
            return []
        except Exception as e:
            logger.error(f"Неожиданная ошибка при получении бронирований: {e}")
            return []
    
    async def _process_booking(self, booking: Dict[str, Any]) -> Dict[str, Any]:
        """Обработка одного бронирования"""
        booking_id = booking.get('id')
        status = booking.get('status')
        planned_start = booking.get('planned_start_time')
        client_name = booking.get('client_name', 'Неизвестный клиент')
        
        if not planned_start:
            return {"updated": False, "notification_sent": False}
        
        # Парсим время начала
        start_time = datetime.fromisoformat(planned_start.replace('Z', '+00:00'))
        now = datetime.now().astimezone()
        
        # Конвертируем в локальное время
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=now.tzinfo)
        
        time_until_start = start_time - now
        minutes_until_start = time_until_start.total_seconds() / 60
        
        logger.info(f"📅 Бронирование {booking_id}: {status}, начало через {minutes_until_start:.1f} мин")
        
        updated = False
        notification_sent = False
        
        # 1. BOOKED → PENDING_CONFIRMATION (за 60 минут)
        if status == "booked" and 0 <= minutes_until_start <= 60:
            await self._transition_to_pending_confirmation(booking)
            updated = True
            notification_sent = True
        
        # 2. PENDING_CONFIRMATION → NO_SHOW (через 120 минут опоздания)
        elif status == "pending_confirmation" and minutes_until_start < -120:
            await self._transition_to_no_show(booking, "pending_confirmation")
            updated = True
        
        # 3. BOOKED/CONFIRMED → NO_SHOW (через 90 минут опоздания)
        elif status in ["booked", "confirmed"] and minutes_until_start < -90:
            await self._transition_to_no_show(booking, status)
            updated = True
        
        # 4. Уведомление "клиент скоро придет" (за 15 минут)
        elif status == "confirmed" and 10 <= minutes_until_start <= 20:
            if not self._was_notification_sent(booking_id, "client_arriving_soon"):
                await self._send_arriving_soon_notification(booking)
                self._mark_notification_sent(booking_id, "client_arriving_soon")
                notification_sent = True
        
        # 5. Уведомление "клиент опаздывает" (от 1 до 15 минут опоздания)
        elif status in ["confirmed", "pending_confirmation"] and -15 <= minutes_until_start <= -1:
            if not self._was_notification_sent(booking_id, "client_overdue"):
                await self._send_overdue_notification(booking)
                self._mark_notification_sent(booking_id, "client_overdue")
                notification_sent = True
        
        # 6. Обработка статуса IN_USE (проверка времени возврата)
        elif status == "in_use":
            return await self._process_in_use_booking(booking)
        
        return {
            "updated": updated,
            "notification_sent": notification_sent
        }
    
    async def _transition_to_pending_confirmation(self, booking: Dict[str, Any]):
        """Переход BOOKED → PENDING_CONFIRMATION"""
        booking_id = booking.get('id')
        client_name = booking.get('client_name', 'Неизвестный клиент')
        
        try:
            # Обновляем статус
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    f"{self.api_base_url}/bookings/{booking_id}",
                    json={"status": "pending_confirmation"}
                )
                response.raise_for_status()
            
            logger.info(f"✅ Бронирование {booking_id} переведено в PENDING_CONFIRMATION")
            
            # Очищаем отслеживание уведомлений при смене статуса
            self._clear_notification_tracking(booking_id)
            
            # Отправляем push-уведомление
            await self._send_push_notification(
                booking_id=booking_id,
                client_name=client_name,
                notification_type="pending_confirmation"
            )
            
        except Exception as e:
            logger.error(f"Ошибка перехода в PENDING_CONFIRMATION для {booking_id}: {e}")
            raise
    
    async def _transition_to_no_show(self, booking: Dict[str, Any], from_status: str):
        """Переход в NO_SHOW при опоздании"""
        booking_id = booking.get('id')
        client_name = booking.get('client_name', 'Неизвестный клиент')
        
        try:
            # Обновляем статус
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    f"{self.api_base_url}/bookings/{booking_id}",
                    json={"status": "no_show"}
                )
                response.raise_for_status()
            
            logger.info(f"⚠️ Бронирование {booking_id} переведено в NO_SHOW (из {from_status})")
            
            # Очищаем отслеживание уведомлений при смене статуса
            self._clear_notification_tracking(booking_id)
            
        except Exception as e:
            logger.error(f"Ошибка перехода в NO_SHOW для {booking_id}: {e}")
            raise
    
    async def _send_arriving_soon_notification(self, booking: Dict[str, Any]):
        """Уведомление 'клиент скоро придет'"""
        booking_id = booking.get('id')
        client_name = booking.get('client_name', 'Неизвестный клиент')
        
        try:
            await self._send_push_notification(
                booking_id=booking_id,
                client_name=client_name,
                notification_type="client_arriving_soon"
            )
            
        except Exception as e:
            logger.error(f"Ошибка отправки уведомления 'arriving_soon' для {booking_id}: {e}")
    
    async def _send_overdue_notification(self, booking: Dict[str, Any]):
        """Уведомление 'клиент опаздывает'"""
        booking_id = booking.get('id')
        client_name = booking.get('client_name', 'Неизвестный клиент')
        planned_start = booking.get('planned_start_time')
        
        # Вычисляем количество минут опоздания
        minutes_overdue = 0
        if planned_start:
            start_time = datetime.fromisoformat(planned_start.replace('Z', '+00:00'))
            now = datetime.now().astimezone()
            if start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=now.tzinfo)
            time_until_start = start_time - now
            minutes_overdue = abs(int(time_until_start.total_seconds() / 60))
        
        try:
            await self._send_push_notification(
                booking_id=booking_id,
                client_name=client_name,
                notification_type="client_overdue",
                additional_data={"minutes_overdue": minutes_overdue}
            )
            
        except Exception as e:
            logger.error(f"Ошибка отправки уведомления 'overdue' для {booking_id}: {e}")

    async def _process_in_use_booking(self, booking: Dict[str, Any]) -> Dict[str, Any]:
        """Обработка бронирования в статусе IN_USE (проверка времени возврата)"""
        booking_id = booking.get('id')
        client_name = booking.get('client_name', 'Неизвестный клиент')
        actual_start = booking.get('actual_start_time')
        duration_hours = booking.get('duration_in_hours', 4)
        
        if not actual_start:
            logger.warning(f"Бронирование {booking_id} в статусе IN_USE, но нет actual_start_time")
            return {"updated": False, "notification_sent": False}
        
        # Парсим время фактического начала
        start_time = datetime.fromisoformat(actual_start.replace('Z', '+00:00'))
        now = datetime.now().astimezone()
        
        # Конвертируем в локальное время
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=now.tzinfo)
        
        # Вычисляем время возврата
        return_time = start_time + timedelta(hours=duration_hours)
        time_until_return = return_time - now
        minutes_until_return = time_until_return.total_seconds() / 60
        
        logger.info(f"📅 Бронирование {booking_id}: IN_USE, возврат через {minutes_until_return:.1f} мин")
        
        notification_sent = False
        
        # 1. Уведомление "время возврата" (за 10-15 минут до окончания)
        if 10 <= minutes_until_return <= 15:
            if not self._was_notification_sent(booking_id, "return_time"):
                await self._send_return_time_notification(booking)
                self._mark_notification_sent(booking_id, "return_time")
                notification_sent = True
        
        # 2. Уведомление "просрочка возврата" (от 5 до 60 минут просрочки)
        elif -60 <= minutes_until_return <= -5:
            if not self._was_notification_sent(booking_id, "return_overdue"):
                await self._send_return_overdue_notification(booking, abs(int(minutes_until_return)))
                self._mark_notification_sent(booking_id, "return_overdue")
                notification_sent = True
        
        return {
            "updated": False,  # Статус не меняем автоматически
            "notification_sent": notification_sent
        }

    async def _send_return_time_notification(self, booking: Dict[str, Any]):
        """Уведомление 'время возврата'"""
        booking_id = booking.get('id')
        client_name = booking.get('client_name', 'Неизвестный клиент')
        
        try:
            await self._send_push_notification(
                booking_id=booking_id,
                client_name=client_name,
                notification_type="return_time"
            )
            
        except Exception as e:
            logger.error(f"Ошибка отправки уведомления 'return_time' для {booking_id}: {e}")

    async def _send_return_overdue_notification(self, booking: Dict[str, Any], minutes_overdue: int):
        """Уведомление 'просрочка возврата'"""
        booking_id = booking.get('id')
        client_name = booking.get('client_name', 'Неизвестный клиент')
        
        try:
            await self._send_push_notification(
                booking_id=booking_id,
                client_name=client_name,
                notification_type="return_overdue",
                additional_data={"minutes_overdue": minutes_overdue}
            )
            
        except Exception as e:
            logger.error(f"Ошибка отправки уведомления 'return_overdue' для {booking_id}: {e}")
    
    def _was_notification_sent(self, booking_id: int, notification_type: str) -> bool:
        """Проверяет, было ли уже отправлено уведомление данного типа для бронирования"""
        return booking_id in self.sent_notifications and notification_type in self.sent_notifications[booking_id]
    
    def _mark_notification_sent(self, booking_id: int, notification_type: str):
        """Отмечает уведомление как отправленное"""
        if booking_id not in self.sent_notifications:
            self.sent_notifications[booking_id] = set()
        self.sent_notifications[booking_id].add(notification_type)
        logger.debug(f"🔖 Уведомление {notification_type} отмечено как отправленное для бронирования {booking_id}")
    
    def _clear_notification_tracking(self, booking_id: int):
        """Очищает отслеживание уведомлений для бронирования (например, когда статус изменился)"""
        if booking_id in self.sent_notifications:
            del self.sent_notifications[booking_id]
            logger.debug(f"🧹 Очищено отслеживание уведомлений для бронирования {booking_id}")

    async def _send_push_notification(self, booking_id: int, client_name: str, notification_type: str, additional_data: Optional[Dict[str, Any]] = None):
        """Отправка push-уведомления"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_base_url}/push-notifications/send-booking-notification",
                    json={
                        "booking_id": booking_id,
                        "client_name": client_name,
                        "notification_type": notification_type,
                        "additional_data": additional_data
                    },
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                logger.info(f"📤 Push-уведомление отправлено: {notification_type} для бронирования {booking_id} (клиент: {client_name})")
                
        except Exception as e:
            logger.error(f"Ошибка отправки push-уведомления {notification_type} для {booking_id}: {e}")
            # Не прерываем выполнение, если уведомление не отправилось
    
    def get_schedule_info(self) -> Dict[str, Any]:
        """Информация о расписании задачи"""
        return {
            "task_name": self.task_name,
            "description": "Автоматизация статусов бронирований и push-уведомлений",
            "schedule": "Каждую минуту",
            "cron": "* * * * *",  # Каждую минуту
            "enabled": True,
            "timeout": 60  # 60 секунд на выполнение
        }

    async def schedule(self, *args, **kwargs):
        """
        Метод schedule не используется для этой задачи, 
        так как она запускается через cron в TaskManager
        """
        logger.info("BookingStatusAutomationTask не требует индивидуального планирования")
        return True


# Функция-исполнитель для APScheduler
async def execute_automation(**kwargs):
    """
    Функция-исполнитель для автоматизации статусов бронирований.
    Вызывается APScheduler каждую минуту.
    
    Args:
        **kwargs: Дополнительные параметры от APScheduler (например, task_type)
    """
    try:
        logger.info("🤖 Запуск автоматизации статусов бронирований...")
        
        # Создаем экземпляр задачи с None параметрами (для автономной работы)
        task = BookingStatusAutomationTask(
            scheduler_instance=None, 
            task_manager=None, 
            settings=None
        )
        
        # Выполняем автоматизацию
        await task.execute()
        
        logger.info("✅ Автоматизация статусов бронирований завершена успешно")
        
    except Exception as e:
        logger.error(f"❌ Ошибка в автоматизации статусов: {e}")
        logger.error(traceback.format_exc()) 