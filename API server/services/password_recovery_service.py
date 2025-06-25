from typing import Dict, Any, Optional, TYPE_CHECKING
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request
from datetime import datetime, timedelta
import random
import string
import logging
import requests
from core.config import settings
from crud.user import user_crud
from services.email_service import email_service

if TYPE_CHECKING:
    from models.user import User

logger = logging.getLogger(__name__)

class PasswordRecoveryService:
    """Сервис для восстановления паролей"""
    
    def __init__(self):
        # Временное хранилище кодов восстановления (в продакшене лучше Redis)
        self.reset_codes_storage = {}
        self.reset_tokens_storage = {}
    
    def generate_reset_code(self) -> str:
        """Генерирует 6-значный код для восстановления пароля"""
        return ''.join(random.choices(string.digits, k=6))
    
    def generate_reset_token(self) -> str:
        """Генерирует токен для подтверждения сброса пароля"""
        return ''.join(random.choices(string.ascii_letters + string.digits, k=32))
    
    async def send_reset_code(
        self, 
        db: AsyncSession, 
        phone: str, 
        user: Any, 
        request: Request
    ) -> Dict[str, Any]:
        """
        Отправляет SMS код для восстановления пароля
        """
        try:
            logger.info(f"🔍 Обрабатываем номер телефона: {phone}")
            
            # Очищаем номер телефона
            phone_digits = ''.join(filter(str.isdigit, phone))
            logger.info(f"🔍 Очищенный номер: {phone_digits}")
            
            # Проверяем формат номера
            if not phone_digits.startswith('7') or len(phone_digits) != 11:
                logger.warning(f"❌ Неверный формат номера: {phone_digits}")
                return {
                    "success": False,
                    "error": "Неверный формат номера телефона"
                }
            
            # Генерируем код
            reset_code = self.generate_reset_code()
            
            # Логируем код для разработки (так как SMS в тестовом режиме)
            logger.info(f"🔑 [DEV] Код восстановления для {phone_digits}: {reset_code}")
            
            # Сохраняем код с временем истечения (5 минут)
            expiry_time = datetime.now() + timedelta(minutes=5)
            self.reset_codes_storage[phone_digits] = {
                'code': reset_code,
                'expires_at': expiry_time,
                'attempts': 0,
                'user_id': user.id,
                'type': 'password_reset'
            }
            
            # Формируем сообщение
            message = f"Код восстановления пароля SUBboards: {reset_code}"
            
            # Отправляем SMS
            sms_sent = self._send_sms(phone_digits, message)
            
            if not sms_sent:
                return {
                    "success": False,
                    "error": "Ошибка отправки SMS"
                }
            
            logger.info(f"✅ SMS код восстановления отправлен для пользователя {user.id}")
            
            return {
                "success": True,
                "message": "SMS код отправлен"
            }
            
        except Exception as e:
            logger.error(f"❌ Ошибка отправки кода восстановления: {str(e)}")
            return {
                "success": False,
                "error": "Внутренняя ошибка при отправке SMS"
            }
    
    async def verify_reset_code(
        self, 
        db: AsyncSession, 
        phone: str, 
        code: str
    ) -> Dict[str, Any]:
        """
        Проверяет SMS код для восстановления пароля
        """
        try:
            # Очищаем номер телефона
            phone_digits = ''.join(filter(str.isdigit, phone))
            
            # Проверяем есть ли код для этого номера
            if phone_digits not in self.reset_codes_storage:
                return {
                    "valid": False,
                    "error": "Код не найден. Запросите новый код."
                }
            
            stored_data = self.reset_codes_storage[phone_digits]
            
            # Проверяем не истек ли код
            if datetime.now() > stored_data['expires_at']:
                del self.reset_codes_storage[phone_digits]
                return {
                    "valid": False,
                    "error": "Код истек. Запросите новый код."
                }
            
            # Проверяем количество попыток
            if stored_data['attempts'] >= 3:
                del self.reset_codes_storage[phone_digits]
                return {
                    "valid": False,
                    "error": "Превышено количество попыток. Запросите новый код."
                }
            
            # Проверяем правильность кода
            if code != stored_data['code']:
                stored_data['attempts'] += 1
                if stored_data['attempts'] >= 3:
                    del self.reset_codes_storage[phone_digits]
                    return {
                        "valid": False,
                        "error": "Превышено количество попыток. Запросите новый код."
                    }
                return {
                    "valid": False,
                    "error": "Неверный код"
                }
            
            # Код верный - создаем токен для сброса пароля
            reset_token = self.generate_reset_token()
            
            # Сохраняем токен с временем истечения (10 минут)
            self.reset_tokens_storage[reset_token] = {
                'phone': phone_digits,
                'user_id': stored_data['user_id'],
                'verified_at': datetime.now(),
                'expires_at': datetime.now() + timedelta(minutes=10)
            }
            
            # Удаляем SMS код - он больше не нужен
            del self.reset_codes_storage[phone_digits]
            
            logger.info(f"✅ Код восстановления подтвержден для пользователя {stored_data['user_id']}")
            
            return {
                "valid": True,
                "reset_token": reset_token
            }
            
        except Exception as e:
            logger.error(f"❌ Ошибка проверки кода восстановления: {str(e)}")
            return {
                "valid": False,
                "error": "Внутренняя ошибка при проверке кода"
            }
    
    async def reset_password(
        self, 
        db: AsyncSession, 
        phone: str, 
        code: str, 
        new_password: str
    ) -> Dict[str, Any]:
        """
        Сбрасывает пароль после подтверждения кода
        """
        try:
            # Сначала проверяем код еще раз
            verify_result = await self.verify_reset_code(db, phone, code)
            
            if not verify_result["valid"]:
                return {
                    "success": False,
                    "error": verify_result["error"]
                }
            
            reset_token = verify_result["reset_token"]
            
            # Проверяем токен
            if reset_token not in self.reset_tokens_storage:
                return {
                    "success": False,
                    "error": "Токен сброса недействителен"
                }
            
            token_data = self.reset_tokens_storage[reset_token]
            
            # Проверяем не истек ли токен
            if datetime.now() > token_data['expires_at']:
                del self.reset_tokens_storage[reset_token]
                return {
                    "success": False,
                    "error": "Токен сброса истек. Повторите процедуру восстановления."
                }
            
            # Получаем пользователя
            user = await user_crud.get_user(db, token_data['user_id'])
            if not user:
                return {
                    "success": False,
                    "error": "Пользователь не найден"
                }
            
            # Обновляем пароль через CRUD
            success = await user_crud.update_password(db, user.id, new_password)
            
            if not success:
                return {
                    "success": False,
                    "error": "Ошибка обновления пароля"
                }
            
            # Удаляем токен сброса
            del self.reset_tokens_storage[reset_token]
            
            # Отправляем уведомление на email если он есть
            if user.email:
                try:
                    email_result = email_service.send_password_changed_notification(
                        to_email=user.email,
                        user_name=user.name
                    )
                    if email_result["success"]:
                        logger.info(f"📧 Уведомление о смене пароля отправлено на {user.email}")
                    else:
                        logger.warning(f"⚠️ Не удалось отправить уведомление на {user.email}: {email_result.get('error')}")
                except Exception as e:
                    logger.error(f"❌ Ошибка отправки уведомления о смене пароля: {str(e)}")
            
            logger.info(f"✅ Пароль успешно изменен для пользователя {user.id}")
            
            return {
                "success": True,
                "message": "Пароль успешно изменен"
            }
            
        except Exception as e:
            logger.error(f"❌ Ошибка сброса пароля: {str(e)}")
            return {
                "success": False,
                "error": "Внутренняя ошибка при сбросе пароля"
            }
    
    async def reset_password_with_token(
        self, 
        db: AsyncSession, 
        phone: str, 
        reset_token: str, 
        new_password: str
    ) -> Dict[str, Any]:
        """
        Сбрасывает пароль используя токен (без повторной проверки кода)
        """
        try:
            # Проверяем токен
            if reset_token not in self.reset_tokens_storage:
                return {
                    "success": False,
                    "error": "Токен сброса недействителен или истек"
                }
            
            token_data = self.reset_tokens_storage[reset_token]
            
            # Проверяем не истек ли токен
            if datetime.now() > token_data['expires_at']:
                del self.reset_tokens_storage[reset_token]
                return {
                    "success": False,
                    "error": "Токен сброса истек. Повторите процедуру восстановления."
                }
            
            # Дополнительная проверка телефона
            phone_digits = ''.join(filter(str.isdigit, phone))
            if phone_digits != token_data['phone']:
                return {
                    "success": False,
                    "error": "Номер телефона не совпадает с токеном"
                }
            
            # Получаем пользователя
            user = await user_crud.get_user(db, token_data['user_id'])
            if not user:
                return {
                    "success": False,
                    "error": "Пользователь не найден"
                }
            
            # Обновляем пароль через CRUD
            success = await user_crud.update_password(db, user.id, new_password)
            
            if not success:
                return {
                    "success": False,
                    "error": "Ошибка обновления пароля"
                }
            
            # Удаляем токен сброса
            del self.reset_tokens_storage[reset_token]
            
            # Отправляем уведомление на email если он есть
            if user.email:
                try:
                    email_result = email_service.send_password_changed_notification(
                        to_email=user.email,
                        user_name=user.name
                    )
                    if email_result["success"]:
                        logger.info(f"📧 Уведомление о смене пароля отправлено на {user.email}")
                    else:
                        logger.warning(f"⚠️ Не удалось отправить уведомление на {user.email}: {email_result.get('error')}")
                except Exception as e:
                    logger.error(f"❌ Ошибка отправки уведомления о смене пароля: {str(e)}")
            
            logger.info(f"✅ Пароль успешно изменен для пользователя {user.id} через токен")
            
            return {
                "success": True,
                "message": "Пароль успешно изменен"
            }
            
        except Exception as e:
            logger.error(f"❌ Ошибка сброса пароля через токен: {str(e)}")
            return {
                "success": False,
                "error": "Внутренняя ошибка при сбросе пароля"
            }
    
    async def email_fallback_recovery(
        self, 
        db: AsyncSession, 
        email: str, 
        phone: str, 
        request: Request
    ) -> Dict[str, Any]:
        """
        Альтернативное восстановление через email + номер телефона при регистрации
        """
        try:
            logger.info(f"🔍 Ищем пользователя по email: {email}")
            
            # Ищем пользователя по email
            user = await user_crud.get_user_by_email(db, email=email)
            
            if not user:
                logger.warning(f"❌ Пользователь с email {email} не найден")
                return {
                    "success": False,
                    "error": "Пользователь с таким email не найден"
                }
            
            logger.info(f"✅ Найден пользователь: ID={user.id}, Phone={user.phone}")
            
            # Очищаем номер телефона для сравнения
            phone_digits = ''.join(filter(str.isdigit, phone))
            user_phone_digits = ''.join(filter(str.isdigit, user.phone))
            
            logger.info(f"🔍 Сравниваем номера: введенный={phone_digits}, в БД={user_phone_digits}")
            
            # Проверяем совпадает ли номер телефона
            if phone_digits != user_phone_digits:
                logger.warning(f"❌ Номера не совпадают: {phone_digits} != {user_phone_digits}")
                return {
                    "success": False,
                    "error": "Номер телефона не совпадает с указанным при регистрации"
                }
            
            # Если все проверки пройдены - отправляем EMAIL с ссылкой восстановления
            logger.info(f"✅ Проверки пройдены, отправляем email восстановления на {email}")
            
            # Генерируем токен для email восстановления
            reset_token = email_service.generate_email_reset_token()
            
            # Отправляем email
            email_result = email_service.send_password_reset_email(
                to_email=email,
                user_name=user.name,
                reset_token=reset_token
            )
            
            if email_result["success"]:
                logger.info(f"✅ Email восстановления отправлен на {email}")
                return {
                    "success": True,
                    "message": "Ссылка для восстановления пароля отправлена на email",
                    "method": "email_link",
                    "dev_info": email_result.get("dev_reset_link")  # Только для разработки
                }
            else:
                logger.error(f"❌ Ошибка отправки email: {email_result.get('error')}")
                return {
                    "success": False,
                    "error": email_result.get("error", "Не удалось отправить email")
                }
            
        except Exception as e:
            logger.error(f"❌ Ошибка email восстановления: {str(e)}")
            return {
                "success": False,
                "error": "Внутренняя ошибка при восстановлении через email"
            }
    
    def _send_sms(self, phone: str, message: str) -> bool:
        """
        Отправляет SMS через SMS.ru API
        """
        try:
            api_id = settings.SMS_RU_API_ID
            
            if not api_id:
                logger.warning("SMS.ru API ключ не настроен!")
                return False
            
            url = "https://sms.ru/sms/send"
            params = {
                'api_id': api_id,
                'to': phone,
                'msg': message,
                'from': 'SubBoard',
                'json': 1,
                'test': 1  # Тестовый режим
            }
            
            logger.info(f"🚀 Отправляем SMS восстановления на {phone}")
            
            response = requests.get(url, params=params, timeout=10)
            result = response.json()
            
            logger.info(f"📱 SMS.ru ответ: {result}")
            
            if result.get('status') == 'OK':
                sms_data = result.get('sms', {})
                for phone_num, sms_info in sms_data.items():
                    if sms_info.get('status') == 'OK':
                        logger.info(f"✅ SMS восстановления отправлена на {phone_num}")
                        return True
                    else:
                        logger.error(f"❌ Ошибка отправки SMS: {sms_info.get('status_text')}")
                return False
            else:
                logger.error(f"❌ SMS.ru API ошибка: {result.get('status_text')}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Исключение при отправке SMS: {e}")
            return False 