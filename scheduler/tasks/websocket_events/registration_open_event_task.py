import asyncio
import logging
import httpx # Меняем requests на httpx для асинхронности
# import socketio # Убираем, если не используем прямое WS соединение
# import psycopg # Убираем синхронный psycopg
from datetime import datetime, timedelta, time, date, timezone
import traceback
import os
from zoneinfo import ZoneInfo # Меняем dateutil.tz и pytz на zoneinfo
from apscheduler.job import Job
from ..base_task import BaseTask
from core.config import scheduler_settings, SchedulerSettings
import json
# Импортируем httpx для HTTP-запросов
import httpx
# Импортируем Optional, Dict, Any для типизации
from typing import Optional, Dict, Any, TYPE_CHECKING
from services.database_service import DatabaseService 
if TYPE_CHECKING:
    from tasks.task_manager import TaskManager

logger = logging.getLogger(__name__)

# --- Статическая функция-обертка для APScheduler --- 
async def execute_job(chat_id: str, db_service: DatabaseService, settings: SchedulerSettings, task_manager: 'TaskManager', task_type: str = None):
    """Статическая обертка, вызываемая APScheduler.
       Выполняет основную логику задачи и запускает перепланирование.
    """
    logger.info(f"[RegOpenEventTask.execute_job] Запуск для chat_id: {chat_id} (тип: {task_type})")
    task_success = False
    try:
        task_instance = RegistrationOpenEventTask(scheduler_instance=None, task_manager=None, settings=settings)
        await task_instance.execute(chat_id, db_service, settings)
        task_success = True
    except Exception as e:
        logger.error(f"[RegOpenEventTask.execute_job] Ошибка при выполнении для chat_id {chat_id}: {e}")
        logger.error(traceback.format_exc())
        task_success = False
        
    # --- Перепланирование --- 
    logger.info(f"[RegOpenEventTask.execute_job] Запуск перепланирования для chat_id: {chat_id}")
    try:
        if task_manager and hasattr(task_manager, 'schedule_registration_open_event'):
            await task_manager.schedule_registration_open_event(chat_id)
            logger.info(f"[RegOpenEventTask.execute_job] Перепланирование для {chat_id} успешно инициировано.")
        else:
            logger.error(f"[RegOpenEventTask.execute_job] TaskManager недоступен. Не удалось перепланировать задачу для {chat_id}.")
    except Exception as reschedule_err:
        logger.error(f"[RegOpenEventTask.execute_job] Ошибка при перепланировании для {chat_id}: {reschedule_err}")
        logger.error(traceback.format_exc())
    # ------------------------
# --------------------------------------------------

class RegistrationOpenEventTask(BaseTask):
    TASK_TYPE = 'registration_open_event'

    def __init__(self, scheduler_instance, task_manager, settings):
        """
        Задача для отправки NOTIFY события при открытии регистрации.
        """
        super().__init__(scheduler_instance, task_manager, settings)
        logger.info(f"RegistrationOpenEventTask инициализирован. API URL: {self.settings.API_URL}")
        # Убираем WS параметры, т.к. используем NOTIFY
        # self.ws_url = ...
        # self.ws_connection_timeout = ...

    # Делаем метод асинхронным и используем httpx
    async def _get_access_settings_from_api(self, chat_id, settings: SchedulerSettings) -> Optional[Dict[str, Any]]:
        """Получает настройки доступа для чата из API сервера (асинхронно)."""
        try:
            chat_id_param = str(chat_id)
            url = f"{settings.API_URL}/api/v1/groups/{chat_id_param}/settings"
            logger.info(f"({self.TASK_TYPE}) Запрос настроек доступа (async): {url}")
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=10)
                response.raise_for_status()
                settings_data = response.json()
                logger.info(f"({self.TASK_TYPE}) Настройки доступа для чата {chat_id} получены из API (async): {settings_data}")
                return settings_data
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"({self.TASK_TYPE}) Настройки для группы {chat_id} не найдены (404) в API.")
            else:
                logger.error(f"({self.TASK_TYPE}) ❌ Ошибка статуса HTTP при получении настроек доступа для {chat_id}: {e}")
            return None
        except httpx.RequestError as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка HTTP при получении настроек доступа для {chat_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Неизвестная ошибка при получении настроек доступа для {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return None

    # Метод расчета остается синхронным, но используем ZoneInfo
    def _calculate_next_registration_time(self, now: datetime, weekday: int, hour: int, minute: int, settings: SchedulerSettings) -> Optional[datetime]:
        """Вычисляет следующее время открытия регистрации."""
        try:
            if not settings.TIMEZONE:
                 logger.error(f"({self.TASK_TYPE}) ❌ Отсутствует настройка TIMEZONE.")
                 return None
                 
            try:
                tz = ZoneInfo(settings.TIMEZONE)
            except Exception as tz_err:
                logger.error(f"({self.TASK_TYPE}) ❌ Неверный формат TIMEZONE '{settings.TIMEZONE}': {tz_err}")
                return None
                
            # now должно быть timezone-aware
            if now.tzinfo is None:
                logger.warning(f"({self.TASK_TYPE}) ⚠️ Переданное 'now' не содержит TZ. Используем текущее время с tz.")
                now = datetime.now(tz)
            else:
                # Убедимся, что now в правильной таймзоне
                now = now.astimezone(tz)

            python_weekday = (int(weekday) - 1 + 7) % 7
            days_ahead = (python_weekday - now.weekday() + 7) % 7
            
            # Сначала получаем дату в нужном поясе
            next_run_date = now.date() + timedelta(days=days_ahead)
            # Создаем наивное время
            next_run_dt_naive = datetime.combine(next_run_date, time(hour=int(hour), minute=int(minute), second=0, microsecond=0))
            # Делаем aware
            next_run_dt_aware = next_run_dt_naive.replace(tzinfo=tz)

            if days_ahead == 0 and now >= next_run_dt_aware:
                next_run_dt_aware += timedelta(days=7)
                logger.info(f"({self.TASK_TYPE}) Время регистрации сегодня ({next_run_dt_aware.strftime('%H:%M')}) уже прошло. Планируем на след. неделю.")

            logger.info(f"({self.TASK_TYPE}) Следующее время открытия регистрации: {next_run_dt_aware}")
            return next_run_dt_aware

        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) Ошибка при расчете времени: {e}")
            logger.error(traceback.format_exc())
            return None

    # Делаем schedule асинхронным
    async def schedule(self, chat_id) -> bool:
        """Планирует задачу уведомления об открытии регистрации (асинхронно)."""
        try:
            chat_id_str = str(chat_id)
            logger.info(f"=== ({self.TASK_TYPE}) Планирование события WS для чата {chat_id_str} (async) ===")

            access_settings = await self._get_access_settings_from_api(chat_id_str, self.settings)
            if not access_settings:
                task_id = self.generate_task_id(self.TASK_TYPE, chat_id_str)
                # Попытаемся удалить задачу из планировщика и БД
                await self.task_manager.delete_task(task_id) 
                logger.info(f"({self.TASK_TYPE}) Удалена задача {task_id} (если была), т.к. настройки не найдены.")
                return False

            # Рассчитываем следующее время запуска
            # Используем ZoneInfo для now
            now = datetime.now(ZoneInfo(self.settings.TIMEZONE)) 
            next_registration = self._calculate_next_registration_time(
                now, access_settings.get("registrationStartDay"), access_settings.get("registrationStartHour"), access_settings.get("registrationStartMinute"),
                self.settings
            )

            if not next_registration:
                logger.error(f"({self.TASK_TYPE}) Не удалось рассчитать время следующего запуска для {chat_id_str}.")
                return False

            task_id = self.generate_task_id(self.TASK_TYPE, chat_id_str)
            task_data = {
                 'comment': f'WS event trigger for {chat_id_str}'
            }
            
            # --- ИСПОЛЬЗУЕМ TaskManager.save_task --- 
            save_result = await self.task_manager.save_task(
                 task_id, 
                 chat_id_str, 
                 self.TASK_TYPE, 
                 next_registration, 
                 task_data
            )
            # ----------------------------------------

            if save_result:
                logger.info(f"({self.TASK_TYPE}) ✅ Задача {task_id} успешно передана в TaskManager для сохранения и планирования на {next_registration} (async)")
                return True
            else:
                logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при сохранении/планировании задачи {task_id} через TaskManager")
                return False

        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Ошибка при планировании задачи для {chat_id_str}: {e}")
            logger.error(traceback.format_exc())
            return False

    # Переименовываем _do_execute обратно в execute и принимаем db_service, settings
    async def execute(self, chat_id, db_service: DatabaseService, settings: SchedulerSettings):
        """Выполняет отправку NOTIFY через DatabaseService."""
        logger.info(f"=== ({self.TASK_TYPE}) Выполнение задачи для чата {chat_id} (async) ===")
        try:
            if not db_service:
                logger.error(f"({self.TASK_TYPE}) ❌ DatabaseService недоступен. Невозможно отправить NOTIFY.")
                return False
            chat_id_str = str(chat_id)
            # Можно опционально снова получить настройки, если они нужны для payload
            # access_settings = await self._get_access_settings_from_api(chat_id_str)
            # if not access_settings:
            #     logger.error(f"({self.TASK_TYPE}) ❌ Настройки для {chat_id_str} не найдены перед отправкой NOTIFY.")
            #     return False

            # Формируем payload для NOTIFY
            payload_dict = {
                'type': 'SHIFT_ACCESS_SENT',
                'chat_id': chat_id_str,
                'timestamp': datetime.now(timezone.utc).isoformat() + 'Z',
                'source': 'scheduler_task_execution'
            }
            
            # Канал для уведомления
            channel = 'websocket_channel'
            env = os.getenv('ENVIRONMENT', 'development')
            if env == 'development':
                logger.info(f"🔥🔥🔥 DEV ОКРУЖЕНИЕ: ({self.TASK_TYPE}) Отправка события SHIFT_ACCESS_SENT в канал '{channel}' для chat_id: {chat_id_str} 🔥🔥🔥")
            elif env == 'production':
                logger.info(f"🔴🔴🔴 PROD ОКРУЖЕНИЕ: ({self.TASK_TYPE}) Отправка события SHIFT_ACCESS_SENT в канал '{channel}' для chat_id: {chat_id_str} 🔴🔴🔴")
            else:
                logger.info(f"({self.TASK_TYPE}) Отправка NOTIFY в канал '{channel}' для chat_id: {chat_id_str}")
            
            # Вызываем метод DatabaseService
            notify_success = await db_service.notify_websocket(channel, payload_dict)
            
            if notify_success:
                logger.info(f"({self.TASK_TYPE}) ✅ NOTIFY для {chat_id_str} успешно отправлен через DatabaseService.")
                return True
            else:
                logger.error(f"({self.TASK_TYPE}) ❌ DatabaseService не смог отправить NOTIFY для {chat_id_str}.")
                return False

        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) ❌ Неожиданная ошибка при выполнении задачи для {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False 