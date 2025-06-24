import json
import aiohttp
import tempfile
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from loguru import logger

from webpush import WebPush, WebPushSubscription
from core.config import get_settings
from models.push_subscription import PushSubscription
from schemas.push_subscription import NotificationPayload, NotificationResult


class PushNotificationService:
    def __init__(self):
        self.settings = get_settings()
        self.web_push = None
        self.temp_private_key_path = None
        self.temp_public_key_path = None
        self._initialize_webpush()
    
    def _initialize_webpush(self):
        """Инициализирует WebPush с VAPID ключами"""
        try:
            if not self.settings.VAPID_PRIVATE_KEY or not self.settings.VAPID_PUBLIC_KEY:
                logger.warning("VAPID ключи не настроены, push уведомления отключены")
                return
            
            # Создаем временные файлы с ключами для webpush 1.0.5
            self._create_temp_key_files()
            
            # Инициализируем WebPush с Path объектами (webpush 1.0.5)
            self.web_push = WebPush(
                private_key=Path(self.temp_private_key_path),
                public_key=Path(self.temp_public_key_path),
                subscriber=self.settings.VAPID_CLAIMS_SUB
            )
            
            logger.info("WebPush инициализирован успешно")
            
        except Exception as e:
            logger.error(f"Ошибка инициализации WebPush: {e}")
            logger.error(f"Детали ошибки: {type(e).__name__}: {str(e)}")
            self.web_push = None
    
    def _create_temp_key_files(self):
        """Создает временные файлы с ключами"""
        try:
            # Создаем временные файлы для ключей
            with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as f:
                f.write(self.settings.VAPID_PRIVATE_KEY)
                self.temp_private_key_path = f.name
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as f:
                f.write(self.settings.VAPID_PUBLIC_KEY)
                self.temp_public_key_path = f.name
                
            logger.info(f"Созданы временные файлы ключей: {self.temp_private_key_path}, {self.temp_public_key_path}")
            
        except Exception as e:
            logger.error(f"Ошибка создания временных файлов ключей: {e}")
            raise
    
    def _cleanup_temp_files(self):
        """Удаляет временные файлы с ключами"""
        try:
            if self.temp_private_key_path and os.path.exists(self.temp_private_key_path):
                os.unlink(self.temp_private_key_path)
                logger.debug(f"Удален временный файл: {self.temp_private_key_path}")
                
            if self.temp_public_key_path and os.path.exists(self.temp_public_key_path):
                os.unlink(self.temp_public_key_path)
                logger.debug(f"Удален временный файл: {self.temp_public_key_path}")
            
        except Exception as e:
            logger.warning(f"Не удалось удалить временные файлы: {e}")
    
    def __del__(self):
        """Деструктор для очистки временных файлов"""
        self._cleanup_temp_files()
    
    def is_available(self) -> bool:
        """Проверяет, доступен ли сервис push уведомлений"""
        return self.web_push is not None
    
    async def send_notification(
        self,
        subscription: PushSubscription,
        payload: NotificationPayload
    ) -> NotificationResult:
        """
        Отправляет push уведомление одному подписчику
        """
        if not self.is_available():
            return NotificationResult(
                success=False,
                error="Push notification service не инициализирован"
            )
        
        try:
            # Создаем WebPushSubscription из нашей модели
            web_push_subscription = WebPushSubscription.model_validate({
                "endpoint": subscription.endpoint,
                "keys": {
                    "auth": subscription.auth,
                    "p256dh": subscription.p256dh
                }
            })
            
            # Подготавливаем сообщение
            message_data = payload.model_dump()
            message = self.web_push.get(
                message=json.dumps(message_data),
                subscription=web_push_subscription
            )
            
            # Отправляем асинхронно
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url=subscription.endpoint,
                    data=message.encrypted,
                    headers=message.headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200 or response.status == 201:
                        logger.info(f"Push уведомление отправлено успешно: {subscription.endpoint}")
                        return NotificationResult(success=True)
                    elif response.status == 410:
                        # Подписка более не действительна
                        logger.warning(f"Подписка недействительна (410): {subscription.endpoint}")
                        return NotificationResult(
                            success=False,
                            error="subscription_invalid",
                            should_remove=True
                        )
                    else:
                        error_text = await response.text()
                        logger.error(f"Ошибка отправки push уведомления: {response.status} - {error_text}")
                        return NotificationResult(
                            success=False,
                            error=f"HTTP {response.status}: {error_text}"
                        )
        
        except aiohttp.ClientError as e:
            logger.error(f"Сетевая ошибка при отправке push уведомления: {e}")
            return NotificationResult(
                success=False,
                error=f"Сетевая ошибка: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Неожиданная ошибка при отправке push уведомления: {e}")
            return NotificationResult(
                success=False,
                error=f"Неожиданная ошибка: {str(e)}"
            )
    
    async def send_bulk_notifications(
        self,
        subscriptions: List[PushSubscription],
        payload: NotificationPayload,
        max_concurrent: int = 10
    ) -> Dict[str, Any]:
        """
        Отправляет push уведомления множеству подписчиков
        """
        if not subscriptions:
            return {
                "total": 0,
                "successful": 0,
                "failed": 0,
                "invalid_subscriptions": []
            }
        
        logger.info(f"Отправка push уведомлений {len(subscriptions)} подписчикам")
        
        # Используем семафор для ограничения одновременных запросов
        import asyncio
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def send_with_semaphore(subscription: PushSubscription):
            async with semaphore:
                return await self.send_notification(subscription, payload)
        
        # Отправляем все уведомления параллельно
        results = await asyncio.gather(
            *[send_with_semaphore(sub) for sub in subscriptions],
            return_exceptions=True
        )
        
        # Анализируем результаты
        successful = 0
        failed = 0
        invalid_subscriptions = []
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Исключение при отправке уведомления: {result}")
                failed += 1
            elif result.success:
                successful += 1
            else:
                failed += 1
                if result.should_remove:
                    invalid_subscriptions.append(subscriptions[i].id)
        
        logger.info(f"Результаты отправки: {successful} успешно, {failed} неудачно")
        
        return {
            "total": len(subscriptions),
            "successful": successful,
            "failed": failed,
            "invalid_subscriptions": invalid_subscriptions
        }
    
    def create_booking_notification(
        self,
        booking_id: int,
        client_name: str,
        notification_type: str,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> NotificationPayload:
        """
        Создает уведомление для бронирования с улучшенным дизайном
        """
        notifications = {
            "pending_confirmation": {
                "title": "🔔 SUPBoard - Требуется подтверждение",
                "body": f"Клиент {client_name} ожидает подтверждения бронирования. Нажмите для быстрого ответа.",
                "icon": "/canoe.png",
                "badge": "/canoe.png",
                "tag": f"booking_{booking_id}_confirmation",
                "requireInteraction": True,  # Уведомление не исчезает автоматически
                "actions": [
                    {
                        "action": "confirm",
                        "title": "✅ Подтвердить",
                        "icon": "/canoe.png"
                    },
                    {
                        "action": "cancel", 
                        "title": "❌ Отменить",
                        "icon": "/canoe.png"
                    }
                ],
                "data": {
                    "booking_id": booking_id,
                    "type": "pending_confirmation",
                    "url": f"/bookings/{booking_id}",
                    "client_name": client_name,
                    "priority": "high"
                }
            },
            "client_arriving": {
                "title": "🚶‍♂️ SubBoard - Клиент приближается",
                "body": f"{client_name} должен прийти в ближайшие 15 минут. Подготовьте инвентарь!",
                "icon": "/canoe.png",
                "badge": "/canoe.png",
                "tag": f"booking_{booking_id}_arriving",
                "requireInteraction": True,
                "actions": [
                    {
                        "action": "prepare",
                        "title": "🎒 Подготовить",
                        "icon": "/canoe.png"
                    },
                    {
                        "action": "view",
                        "title": "👁️ Посмотреть",
                        "icon": "/canoe.png"
                    }
                ],
                "data": {
                    "booking_id": booking_id,
                    "type": "client_arriving",
                    "url": f"/bookings/{booking_id}",
                    "client_name": client_name,
                    "priority": "medium"
                }
            },
            "client_arriving_soon": {
                "title": "⏰ SubBoard - Клиент скоро придет",
                "body": f"{client_name} должен прийти в ближайшие 15 минут. Время подготовиться!",
                "icon": "/canoe.png",
                "badge": "/canoe.png",
                "tag": f"booking_{booking_id}_arriving_soon",
                "requireInteraction": True,
                "actions": [
                    {
                        "action": "prepare",
                        "title": "🎒 Подготовить",
                        "icon": "/canoe.png"
                    },
                    {
                        "action": "contact",
                        "title": "📞 Связаться",
                        "icon": "/canoe.png"
                    }
                ],
                "data": {
                    "booking_id": booking_id,
                    "type": "client_arriving_soon", 
                    "url": f"/bookings/{booking_id}",
                    "client_name": client_name,
                    "priority": "medium"
                }
            },
            "client_overdue": {
                "title": "⚠️ SubBoard - Клиент опаздывает",
                "body": f"{client_name} опаздывает на {additional_data.get('minutes_overdue', 0)} мин. Возможно, стоит связаться?",
                "icon": "/canoe.png", 
                "badge": "/canoe.png",
                "tag": f"booking_{booking_id}_overdue",
                "requireInteraction": True,
                "actions": [
                    {
                        "action": "contact",
                        "title": "📞 Позвонить",
                        "icon": "/canoe.png"
                    },
                    {
                        "action": "arrived",
                        "title": "✅ Пришел",
                        "icon": "/canoe.png"
                    },
                    {
                        "action": "cancel",
                        "title": "❌ Отменить",
                        "icon": "/canoe.png"
                    }
                ],
                "data": {
                    "booking_id": booking_id,
                    "type": "client_overdue",
                    "url": f"/bookings/{booking_id}",
                    "client_name": client_name,
                    "minutes_overdue": additional_data.get('minutes_overdue', 0) if additional_data else 0,
                    "priority": "high"
                }
            },
            "return_time": {
                "title": "🔄 SubBoard - Время возврата",
                "body": f"{client_name} должен вернуть инвентарь. Напомните клиенту о времени возврата.",
                "icon": "/canoe.png",
                "badge": "/canoe.png", 
                "tag": f"booking_{booking_id}_return",
                "requireInteraction": True,
                "actions": [
                    {
                        "action": "remind",
                        "title": "📢 Напомнить",
                        "icon": "/canoe.png"
                    },
                    {
                        "action": "returned",
                        "title": "✅ Вернул",
                        "icon": "/canoe.png"
                    }
                ],
                "data": {
                    "booking_id": booking_id,
                    "type": "return_time",
                    "url": f"/bookings/{booking_id}",
                    "client_name": client_name,
                    "priority": "medium"
                }
            },
            "return_overdue": {
                "title": "🚨 SubBoard - Просрочка возврата",
                "body": f"{client_name} просрочил возврат на {additional_data.get('minutes_overdue', 0)} мин! Срочно свяжитесь с клиентом.",
                "icon": "/canoe.png",
                "badge": "/canoe.png",
                "tag": f"booking_{booking_id}_return_overdue",
                "requireInteraction": True,
                "actions": [
                    {
                        "action": "contact_urgent",
                        "title": "🚨 Срочно позвонить",
                        "icon": "/canoe.png"
                    },
                    {
                        "action": "returned",
                        "title": "✅ Вернул",
                        "icon": "/canoe.png"
                    },
                    {
                        "action": "lost",
                        "title": "⚠️ Потерял",
                        "icon": "/canoe.png"
                    }
                ],
                "data": {
                    "booking_id": booking_id,
                    "type": "return_overdue",
                    "url": f"/bookings/{booking_id}",
                    "client_name": client_name,
                    "minutes_overdue": additional_data.get('minutes_overdue', 0) if additional_data else 0,
                    "priority": "urgent"
                }
            }
        }
        
        notification_config = notifications.get(notification_type)
        if not notification_config:
            raise ValueError(f"Неизвестный тип уведомления: {notification_type}")
        
        return NotificationPayload(**notification_config)
    
    def get_vapid_public_key(self) -> Optional[str]:
        """Возвращает публичный VAPID ключ для клиента"""
        if not self.is_available():
            return None
        
        return self.settings.VAPID_PUBLIC_KEY

    def get_vapid_public_key_for_web_push(self) -> Optional[str]:
        """Возвращает публичный VAPID ключ в формате base64url для Web Push API"""
        if not self.is_available():
            return None
        
        try:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.serialization import load_pem_public_key
            import base64
            
            # Загружаем PEM ключ
            pem_key = self.settings.VAPID_PUBLIC_KEY
            if not pem_key:
                return None
            
            # Парсим PEM ключ
            public_key = load_pem_public_key(pem_key.encode('utf-8'))
            
            # Получаем raw public key bytes в формате uncompressed point
            raw_key = public_key.public_bytes(
                encoding=serialization.Encoding.X962,
                format=serialization.PublicFormat.UncompressedPoint
            )
            
            # Конвертируем в base64url (без padding)
            base64url_key = base64.urlsafe_b64encode(raw_key).decode('utf-8').rstrip('=')
            
            return base64url_key
            
        except Exception as e:
            logger.error(f"Ошибка конвертации VAPID ключа для Web Push: {e}")
            return None


# Глобальный экземпляр сервиса (ленивая инициализация)
_push_notification_service = None

def get_push_notification_service() -> PushNotificationService:
    """Получает экземпляр сервиса push уведомлений (ленивая инициализация)"""
    global _push_notification_service
    if _push_notification_service is None:
        _push_notification_service = PushNotificationService()
    return _push_notification_service

# Обратная совместимость
push_notification_service = get_push_notification_service() 