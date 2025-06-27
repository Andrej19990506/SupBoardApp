from fastapi import APIRouter, Depends, HTTPException, status, Header, Request, Path, Body, Response
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from db.session import get_db_session
from crud.user import user_crud
from core.config import settings
from schemas.customer import CustomerCreate
from schemas.user import UserCreate, UserCreateOAuth
from services.auth_security_service import AuthSecurityService
from core.session_middleware import require_valid_session
import random
import string
import requests
from datetime import datetime, timedelta
import redis
import asyncio
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
import jwt
from typing import Dict, Any, Optional
import logging

# Создаем router для auth endpoints
router = APIRouter()

# Подключение к Redis для хранения SMS кодов
# redis_client = redis.Redis(host='localhost', port=6379, db=0)

# Временное хранение кодов в памяти (для тестирования)
sms_codes_storage = {}

# Хранилище токенов регистрации (заменяет SMS коды для регистрации)
registration_tokens_storage = {}

# Настройка логирования
logger = logging.getLogger(__name__)

# Настройка паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Инициализация сервиса безопасности
security_service = AuthSecurityService()

# Временное хранилище настройки автоудаления (можно заменить на Redis/БД)
auto_cleanup_settings = {"days": 30}

class SMSCodeCreate(BaseModel):
    phone: str

class SMSCodeVerify(BaseModel):
    phone: str
    code: str

class RegisterRequest(BaseModel):
    phone: str
    password: str
    name: str
    email: str
    registration_token: str  # Новое поле!

class LoginRequest(BaseModel):
    phone: str
    password: str

def generate_sms_code() -> str:
    """Генерирует 4-значный SMS код для логина"""
    return ''.join(random.choices(string.digits, k=4))

def generate_registration_sms_code() -> str:
    """Генерирует 6-значный SMS код для регистрации"""
    return ''.join(random.choices(string.digits, k=6))

def check_sms_ru_senders(api_id: str) -> list:
    """Проверяет список доступных отправителей в SMS.ru"""
    import requests
    try:
        url = "https://sms.ru/my/senders"
        params = {
            'api_id': api_id,
            'json': 1
        }
        response = requests.get(url, params=params, timeout=10)
        result = response.json()
        print(f"[SMS.ru] Список отправителей: {result}")
        
        if result.get('status') == 'OK':
            return result.get('senders', [])
        else:
            print(f"[SMS.ru] Ошибка получения отправителей: {result}")
            return []
    except Exception as e:
        print(f"[SMS.ru] Ошибка при получении списка отправителей: {e}")
        return []

def send_sms_via_sms_ru(phone: str, message: str) -> bool:
    """Отправляет SMS через SMS.ru API"""
    from core.config import settings
    api_id = settings.SMS_RU_API_ID
    
    if not api_id:
        print("SMS.ru API ключ не настроен!")
        return False
    
    # Проверяем доступных отправителей
    senders = check_sms_ru_senders(api_id)
    print(f"[SMS.ru] Доступные отправители: {senders}")
    
    url = "https://sms.ru/sms/send"
    params = {
        'api_id': api_id,
        'to': phone,
        'msg': message,
        'from': 'SubBoard',
        'json': 1,
        'test': 1
    }
    
    try:
        print(f"[SMS.ru] Отправляем SMS на {phone} с текстом: {message}")
        print(f"[SMS.ru] URL: {url}")
        print(f"[SMS.ru] Параметры: {params}")
        
        response = requests.get(url, params=params, timeout=10)
        result = response.json()
        
        print(f"[SMS.ru] Ответ сервера: {result}")
        
        # Проверяем детальный ответ
        if result.get('status') == 'OK':
            # Проверяем статус конкретной SMS
            sms_data = result.get('sms', {})
            for phone_num, sms_info in sms_data.items():
                if sms_info.get('status') == 'OK':
                    print(f"[SMS.ru] ✅ SMS успешно отправлена на {phone_num}, ID: {sms_info.get('sms_id')}")
                    print(f"[SMS.ru] Баланс после отправки: {result.get('balance', 'неизвестно')} руб.")
                    return True
                else:
                    print(f"[SMS.ru] ❌ Ошибка отправки SMS на {phone_num}: {sms_info.get('status_text', 'Unknown error')}")
            return False
        else:
            print(f"[SMS.ru] ❌ Общая ошибка API: {result.get('status_text', 'Unknown error')}")
            print(f"[SMS.ru] Код ошибки: {result.get('status_code', 'неизвестно')}")
            return False
    except Exception as e:
        print(f"[SMS.ru] ❌ Исключение при отправке SMS: {e}")
        return False

def send_sms_via_smsc(phone: str, message: str) -> bool:
    """Отправляет SMS через SMSC.ru API (альтернатива)"""
    # Пока что возвращаем True для тестирования
    # В реальности здесь будет SMSC.ru API
    print(f"[ТЕСТ] SMS отправлена на {phone}: {message}")
    return True

@router.post("/check-phone")
async def check_phone_exists(
    sms_data: SMSCodeCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Проверяет существование аккаунта по номеру телефона
    """
    try:
        logger.info(f"🔍 Начинаем проверку номера телефона: {sms_data.phone}")
        
        # Очищаем номер телефона от форматирования
        phone = ''.join(filter(str.isdigit, sms_data.phone))
        logger.info(f"📞 Очищенный номер: {phone}")
        
        # Проверяем формат номера (должен начинаться с 7 и быть 11 цифр)
        if not phone.startswith('7') or len(phone) != 11:
            logger.warning(f"⚠️ Неверный формат номера: {phone}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат номера телефона"
            )
        
        # Ищем существующего пользователя
        formatted_phone = f"+{phone}"
        logger.info(f"🔍 Проверяем существование клиента по номеру: {formatted_phone}")
        
        # 🔍 ДОПОЛНИТЕЛЬНЫЕ ЛОГИ ДЛЯ ОТЛАДКИ
        logger.info(f"🔍 Исходный номер: '{sms_data.phone}'")
        logger.info(f"🔍 Очищенные цифры: '{phone}'")
        logger.info(f"🔍 Форматированный номер для поиска: '{formatted_phone}'")
        
        # Попробуем также поискать в разных форматах
        possible_formats = [
            formatted_phone,  # +79135849601
            sms_data.phone,   # Исходный формат от клиента
            phone,            # Только цифры 79135849601
            f"8{phone[1:]}" if phone.startswith('7') else phone,  # 89135849601
            f"+{phone[:1]} ({phone[1:4]}) {phone[4:7]}-{phone[7:9]}-{phone[9:11]}",  # +7 (913) 584-96-01
        ]
        
        logger.info(f"🔍 Будем искать в форматах: {possible_formats}")
        
        try:
            existing_client = None
            found_format = None
            
            # Ищем по всем возможным форматам
            for format_to_try in possible_formats:
                logger.info(f"🔍 Пробуем формат: '{format_to_try}'")
                try:
                    candidate = await user_crud.get_user_by_phone(db, phone=format_to_try)
                    if candidate:
                        existing_client = candidate
                        found_format = format_to_try
                        logger.info(f"✅ НАЙДЕН пользователь в формате: '{format_to_try}' - ID={candidate.id}, Name='{candidate.name}'")
                        break
                    else:
                        logger.info(f"❌ Не найден в формате: '{format_to_try}'")
                except Exception as format_error:
                    logger.error(f"❌ Ошибка поиска в формате '{format_to_try}': {format_error}")
            
            # Дополнительная проверка - выведем всех пользователей из БД для отладки
            try:
                from sqlalchemy import text
                result = await db.execute(text("SELECT id, name, phone FROM users ORDER BY id DESC LIMIT 5"))
                all_users = result.fetchall()
                logger.info(f"🔍 Последние 5 пользователей в БД:")
                for user_row in all_users:
                    logger.info(f"  - ID={user_row[0]}, Name='{user_row[1]}', Phone='{user_row[2]}'")
            except Exception as debug_error:
                logger.error(f"❌ Ошибка получения списка пользователей: {debug_error}")
            
            if existing_client:
                logger.info(f"✅ Запрос к базе выполнен успешно - найден пользователь в формате '{found_format}'")
            else:
                logger.info(f"✅ Запрос к базе выполнен успешно - пользователь НЕ найден ни в одном формате")
                
        except Exception as db_error:
            logger.error(f"❌ Ошибка запроса к базе данных: {db_error}")
            logger.error(f"❌ Тип ошибки: {type(db_error)}")
            import traceback
            logger.error(f"❌ Трассировка: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка базы данных: {str(db_error)}"
            )
        
        if not existing_client:
            logger.info(f"❌ Клиент не найден с номером: {formatted_phone}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь с таким номером телефона не найден. Пожалуйста, зарегистрируйтесь."
            )
        
        logger.info(f"✅ Найден клиент: ID={existing_client.id}, Имя={existing_client.name}")
        
        return {
            "success": True,
            "message": "Пользователь найден",
            "user_exists": True,
            "user_name": existing_client.name,
            "user_avatar": existing_client.avatar
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Неожиданная ошибка в check_phone_exists: {e}")
        logger.error(f"❌ Тип ошибки: {type(e)}")
        import traceback
        logger.error(f"❌ Полная трассировка: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )

@router.post("/send-sms-code")
async def send_sms_code(
    sms_data: SMSCodeCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Отправляет SMS код на указанный номер телефона (только если пользователь существует)
    """
    try:
        # Очищаем номер телефона от форматирования
        phone = ''.join(filter(str.isdigit, sms_data.phone))
        
        # Проверяем формат номера (должен начинаться с 7 и быть 11 цифр)
        if not phone.startswith('7') or len(phone) != 11:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат номера телефона"
            )
        
        # 🛡️ ПРОВЕРЯЕМ SMS RATE LIMIT
        formatted_phone = f"+{phone}"
        rate_limit_result = await security_service.check_sms_rate_limit(db, formatted_phone)
        
        if not rate_limit_result["allowed"]:
            logger.warning(f"🚫 SMS rate limit превышен для {formatted_phone}: {rate_limit_result['requests_count']}/{rate_limit_result['max_requests']}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Превышен лимит SMS запросов. Попробуйте через {rate_limit_result['reset_at']} минут."
            )
        
        logger.info(f"✅ SMS rate limit OK для {formatted_phone}: {rate_limit_result['requests_count']}/{rate_limit_result['max_requests']}")
        
        # 🛡️ ПРОВЕРЯЕМ LOGIN RATE LIMIT
        login_rate_result = await security_service.check_login_rate_limit(db, request, formatted_phone)
        
        if not login_rate_result["allowed"]:
            logger.warning(f"🚫 Login rate limit превышен для {formatted_phone}: {login_rate_result['requests_count']}/{login_rate_result['max_requests']}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Превышен лимит попыток входа. Попробуйте позже."
            )
        
        # Проверяем что пользователь существует ДО отправки SMS
        logger.info(f"🔍 Проверяем существование клиента перед отправкой SMS: {formatted_phone}")
        
        # 🔍 ИСПОЛЬЗУЕМ ТАКОЙ ЖЕ ПОИСК В РАЗНЫХ ФОРМАТАХ КАК В check-phone
        possible_formats = [
            formatted_phone,  # +79135849601
            sms_data.phone,   # Исходный формат от клиента
            phone,            # Только цифры 79135849601
            f"8{phone[1:]}" if phone.startswith('7') else phone,  # 89135849601
            f"+{phone[:1]} ({phone[1:4]}) {phone[4:7]}-{phone[7:9]}-{phone[9:11]}",  # +7 (913) 584-96-01
        ]
        
        logger.info(f"🔍 [send-sms] Будем искать в форматах: {possible_formats}")
        
        existing_client = None
        found_format = None
        
        # Ищем по всем возможным форматам
        for format_to_try in possible_formats:
            logger.info(f"🔍 [send-sms] Пробуем формат: '{format_to_try}'")
            try:
                candidate = await user_crud.get_user_by_phone(db, phone=format_to_try)
                if candidate:
                    existing_client = candidate
                    found_format = format_to_try
                    logger.info(f"✅ [send-sms] НАЙДЕН пользователь в формате: '{format_to_try}' - ID={candidate.id}, Name='{candidate.name}'")
                    break
                else:
                    logger.info(f"❌ [send-sms] Не найден в формате: '{format_to_try}'")
            except Exception as format_error:
                logger.error(f"❌ [send-sms] Ошибка поиска в формате '{format_to_try}': {format_error}")
        
        if not existing_client:
            logger.info(f"❌ [send-sms] Клиент не найден ни в одном формате, отменяем отправку SMS")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь с таким номером телефона не найден. Пожалуйста, зарегистрируйтесь."
            )
        
        logger.info(f"✅ [send-sms] Клиент найден в формате '{found_format}', отправляем SMS: ID={existing_client.id}, Имя={existing_client.name}")
        
        # Генерируем код
        code = generate_sms_code()
        
        # Сохраняем код с временем истечения (1 минута)
        expiry_time = datetime.now() + timedelta(minutes=1)
        sms_codes_storage[phone] = {
            'code': code,
            'expires_at': expiry_time,
            'attempts': 0,
            'type': 'login'  # Помечаем как код логина
        }
        
        # Формируем сообщение
        message = f"Ваш код для входа в SUBboards: {code}"
        
        # Отправляем SMS через SMS.ru
        success = send_sms_via_sms_ru(phone, message)  # Реальная отправка
        # success = send_sms_via_smsc(phone, message)  # Тестовый режим (отключен)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Ошибка отправки SMS"
            )
        
        return {
            "success": True,
            "message": "SMS код отправлен",
            "expires_in": 60  # 1 минута в секундах
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )

@router.post("/verify-sms-code")
async def verify_sms_code(
    verify_data: SMSCodeVerify,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Проверяет SMS код и авторизует пользователя
    """
    try:
        # Очищаем номер телефона
        phone = ''.join(filter(str.isdigit, verify_data.phone))
        
        # 🛡️ ГЕНЕРИРУЕМ DEVICE FINGERPRINT (используем тот же алгоритм что и при регистрации)
        device_fingerprints = security_service.generate_flexible_fingerprint(request)
        device_fingerprint = device_fingerprints["strict"]
        ip_address = security_service.get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        
        logger.info(f"🔐 Device fingerprint: {device_fingerprint[:16]}... IP: {ip_address}")
        
        # 🛡️ АНАЛИЗ УСТРОЙСТВА
        device_info = security_service.parse_device_info(user_agent)
        location_info = security_service.get_location_info(ip_address)
        
        logger.info(f"📱 Device info: {device_info}")
        logger.info(f"🌍 Location info: {location_info}")
        
        # Проверяем есть ли код для этого номера
        if phone not in sms_codes_storage:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Код не найден. Запросите новый код."
            )
        
        stored_data = sms_codes_storage[phone]
        
        # Проверяем не истек ли код
        if datetime.now() > stored_data['expires_at']:
            del sms_codes_storage[phone]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Код истек. Запросите новый код."
            )
        
        # Проверяем количество попыток
        if stored_data['attempts'] >= 3:
            del sms_codes_storage[phone]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Превышено количество попыток. Запросите новый код."
            )
        
        # Проверяем правильность кода
        if verify_data.code != stored_data['code']:
            stored_data['attempts'] += 1
            if stored_data['attempts'] >= 3:
                del sms_codes_storage[phone]
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Превышено количество попыток. Запросите новый код."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный код"
            )
        
        # Проверяем тип кода (логин или регистрация)
        code_type = stored_data.get('type', 'login')
        logger.info(f"🔍 Тип кода: {code_type}")
        
        # Ищем существующего пользователя
        formatted_phone = f"+{phone}"
        logger.info(f"🔍 Ищем клиента по номеру: {formatted_phone}")
        
        # 🔍 ИСПОЛЬЗУЕМ ПОИСК В РАЗНЫХ ФОРМАТАХ КАК В check-phone и send-sms-code
        # Получаем исходный номер из verify_data
        possible_formats = [
            formatted_phone,  # +79135849601
            verify_data.phone,   # Исходный формат от клиента
            phone,            # Только цифры 79135849601
            f"8{phone[1:]}" if phone.startswith('7') else phone,  # 89135849601
        ]
        
        logger.info(f"🔍 [verify-sms] Будем искать в форматах: {possible_formats}")
        
        existing_client = None
        found_format = None
        
        # Ищем по всем возможным форматам
        for format_to_try in possible_formats:
            logger.info(f"🔍 [verify-sms] Пробуем формат: '{format_to_try}'")
            try:
                candidate = await user_crud.get_user_by_phone(db, phone=format_to_try)
                if candidate:
                    existing_client = candidate
                    found_format = format_to_try
                    logger.info(f"✅ [verify-sms] НАЙДЕН пользователь в формате: '{format_to_try}' - ID={candidate.id}, Name='{candidate.name}'")
                    break
                else:
                    logger.info(f"❌ [verify-sms] Не найден в формате: '{format_to_try}'")
            except Exception as format_error:
                logger.error(f"❌ [verify-sms] Ошибка поиска в формате '{format_to_try}': {format_error}")
        
        if code_type == 'login':
            # Для входа клиент ДОЛЖЕН существовать
            if not existing_client:
                logger.info(f"❌ [verify-sms] Клиент не найден для входа ни в одном формате")
                # Удаляем код только при ошибке
                del sms_codes_storage[phone]
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Пользователь с таким номером телефона не зарегистрирован. Пожалуйста, зарегистрируйтесь."
                )
            logger.info(f"✅ [verify-sms] Найден существующий клиент для входа в формате '{found_format}': ID={existing_client.id}, Имя={existing_client.name}")
            client = existing_client

            # Сохраняем все нужные поля клиента в переменные сразу!
            client_id = str(client.id)
            client_name = client.name
            client_phone = client.phone
            client_avatar = client.avatar
            client_created_at = client.created_at.isoformat() if client.created_at else ""
            client_updated_at = client.updated_at.isoformat() if client.updated_at else ""
            
            # Код верный для входа, удаляем его из хранилища
            del sms_codes_storage[phone]
        else:
            # Для регистрации клиент НЕ должен существовать
            if existing_client:
                logger.info(f"❌ Клиент уже существует для регистрации: ID={existing_client.id}")
                # Удаляем код только при ошибке
                del sms_codes_storage[phone]
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Пользователь с таким номером телефона уже зарегистрирован. Войдите в систему."
                )
            logger.info(f"✅ Клиент не найден для регистрации, это правильно")
            
            # Создаем токен регистрации вместо хранения кода в памяти
            registration_token = security_service.generate_secure_token(32)
            
            # Сохраняем токен регистрации с временем истечения (10 минут)
            registration_tokens_storage[registration_token] = {
                'phone': formatted_phone,
                'verified_at': datetime.now(),
                'expires_at': datetime.now() + timedelta(minutes=10)
            }
            
            # Удаляем SMS код из storage - он больше не нужен
            del sms_codes_storage[phone]
            logger.info(f"✅ SMS код удален, создан токен регистрации для {formatted_phone}")
            
            # Для регистрации мы НЕ создаем клиента здесь - это делается в /register endpoint
            # Возвращаем токен регистрации для фронтенда
            return {
                "success": True,
                "message": "SMS код подтвержден. Завершите регистрацию.",
                "phone": formatted_phone,
                "registration_token": registration_token  # Новое поле!
            }
        
        # 🛡️ СОЗДАЕМ SECURE SESSION
        refresh_token = security_service.generate_secure_token(32)
        print(f"🔍 [verify-sms] Создаем secure session для client_id: {client_id}")
        try:
            # Создаем сессию устройства
            device_session = await security_service.create_secure_session(
                db=db,
                user=client,  # Исправляем: client -> user (но переменная называется client)
                request=request,
                refresh_token=refresh_token
            )
            print(f"✅ [verify-sms] Создана secure session: ID={device_session.id}")
            logger.info(f"✅ Создана secure session: ID={device_session.id}")
            # Обновляем информацию о последнем входе клиента
            await security_service.update_user_login_info(db, client, request)
            # Анализируем риски входа
            risk_analysis = await security_service.analyze_login_risk(db, client, request)
            logger.info(f"🔍 Risk analysis: {risk_analysis}")
        except Exception as security_error:
            print(f"❌ [verify-sms] Ошибка создания secure session: {security_error}")
            logger.error(f"❌ Ошибка создания secure session: {security_error}")
            import traceback
            print(f"❌ [verify-sms] Traceback: {traceback.format_exc()}")
            # Продолжаем с обычными токенами в случае ошибки
        
        # Генерируем правильный JWT access token
        access_token_data = {
            "sub": client_id,
            "phone": client_phone,
            "name": client_name,
            "provider": "sms"
        }
        access_token = create_access_token(data=access_token_data)
        # Формируем ответ
        user_data = {
            "id": client_id,
            "name": client_name,
            "email": client_phone,  # Используем телефон как email
            "avatar": client_avatar,
            "role": "user",
            "provider": "sms",
            "providerId": phone,
            "createdAt": client_created_at,
            "updatedAt": client_updated_at
        }
        logger.info(f"DEBUG: user_data={user_data}")
        
        # 🛡️ УСТАНАВЛИВАЕМ HTTPONLY COOKIE с refresh token
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            max_age=30 * 24 * 60 * 60,  # 30 дней в секундах
            httponly=True,  # Недоступен для JavaScript
            secure=True,    # Только через HTTPS
            samesite="lax"  # Защита от CSRF
        )
        print(f"🔐 [verify-sms] Установлен HttpOnly cookie с refresh token")
        
        return {
            "user": user_data,
            "token": access_token,
            "refreshToken": refresh_token  # Оставляем в ответе для совместимости
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"❌ EXCEPTION in verify_sms_code: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )

@router.get("/me")
async def get_current_user(
    authorization: str = Header(None),
    request: Request = None,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получить данные текущего пользователя по токену
    """
    try:
        # Проверяем наличие токена в заголовке
        if not authorization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Отсутствует токен авторизации"
            )
        
        # Извлекаем токен (формат: "Bearer token_value")
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный формат токена"
            )
        
        token = authorization.replace("Bearer ", "")
        print(f"🔍 Проверяем JWT токен: {token[:20]}...")
        
        # Проверяем JWT токен (начинается с eyJ)
        if not token.startswith("eyJ"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный формат токена"
            )
        
        # Декодируем JWT токен
        try:
            import jwt
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
            client_id = int(payload.get("sub"))
        except (jwt.InvalidTokenError, ValueError, TypeError) as e:
            print(f"❌ JWT ошибка в /me: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный токен"
            )
        
        print(f"🔍 Ищем пользователя с ID: {client_id}")
        
        # Получаем пользователя из базы данных
        user = await user_crud.get_user(db, client_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден"
            )
        
        print(f"✅ Пользователь найден: {user.name}")
        
        # 🛡️ ОБЯЗАТЕЛЬНАЯ ПРОВЕРКА DEVICE SESSION
        refresh_token_from_cookie = security_service.get_refresh_token_from_cookie(request)
        if not refresh_token_from_cookie:
            print(f"❌ Refresh token отсутствует в cookie - сессия недействительна")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Сессия недействительна - отсутствует refresh token"
            )
        
        # Проверяем что сессия существует и активна
        from crud.device_session import CRUDDeviceSession
        crud = CRUDDeviceSession()
        current_session = await crud.get_session_by_refresh_token(db, refresh_token_from_cookie)
        
        if not current_session:
            print(f"❌ Device session не найдена для refresh token из cookie")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Сессия завершена или недействительна"
            )
        
        if current_session.user_id != user.id:
            print(f"❌ Device session принадлежит другому пользователю: {current_session.user_id} != {user.id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Сессия недействительна"
            )
        
        print(f"✅ Device session валидна: ID={current_session.id}")
        
        # Для JWT токенов провайдер определяется из payload или используем "jwt"
        provider = payload.get("provider", "jwt")
        
        # Формируем ответ
        user_data = {
            "id": str(user.id),
            "name": user.name,
            "email": user.phone,  # Используем телефон как email
            "avatar": user.avatar,
            "role": "user",
            "provider": provider,
            "providerId": str(user.id),
            "createdAt": user.created_at.isoformat() if user.created_at else "",
            "updatedAt": user.updated_at.isoformat() if user.updated_at else ""
        }
        
        print(f"✅ Возвращаем данные пользователя: {user_data}")
        return user_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка в /me: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )

@router.post("/telegram")
async def authenticate_telegram(
    telegram_data: dict,
    response: Response,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Авторизация через Telegram
    """
    # Простая реализация для Telegram авторизации
    try:
        user_id = telegram_data.get('id')
        first_name = telegram_data.get('first_name', '')
        last_name = telegram_data.get('last_name', '')
        username = telegram_data.get('username')
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверные данные Telegram"
            )
        
        # Формируем имя пользователя
        full_name = f"{first_name} {last_name}".strip()
        if full_name:
            name = full_name
        elif username:
            name = username
        else:
            name = f"Пользователь {user_id}"
        
        print(f"🔍 Telegram auth data: first_name='{first_name}', last_name='{last_name}', username='{username}', final_name='{name}'")
        
        # Ищем или создаем пользователя
        # Используем сокращенный Telegram ID как телефон
        short_telegram_id = str(user_id)[-10:]  # Берем последние 10 цифр
        phone = f"+t{short_telegram_id}"  # Временный телефон для Telegram пользователей (макс 12 символов)
        
        existing_user = await user_crud.get_user_by_phone(db, phone=phone)
        
        if existing_user:
            # Обновляем данные существующего пользователя если они изменились
            update_needed = False
            if existing_user.name != name:
                existing_user.name = name
                update_needed = True
            
            # Обновляем аватар если есть
            photo_url = telegram_data.get('photo_url')
            if photo_url and existing_user.avatar != photo_url:
                existing_user.avatar = photo_url
                update_needed = True
            
            if update_needed:
                await db.commit()
                await db.refresh(existing_user)
                print(f"✅ Обновлены данные пользователя: {existing_user.name}")
            
            user = existing_user
        else:
            user_data = UserCreate(
                name=name,
                phone=phone,
                avatar=telegram_data.get('photo_url')
            )
            user = await user_crud.create_user(db, user_in=user_data)
            print(f"✅ Создан новый пользователь: {user.name}")
        
        # Генерируем токены
        access_token = f"telegram_token_{user.id}_{int(datetime.now().timestamp())}"
        refresh_token = f"refresh_{user.id}_{int(datetime.now().timestamp())}"
        
        # Формируем ответ
        user_data = {
            "id": str(user.id),
            "name": user.name,
            "email": user.phone,
            "avatar": telegram_data.get('photo_url'),
            "role": "admin",  # Telegram пользователи - это бизнесмены
            "provider": "telegram",
            "providerId": str(user_id),
            "createdAt": user.created_at.isoformat() if user.created_at else "",
            "updatedAt": user.updated_at.isoformat() if user.updated_at else ""
        }
        
        # 🛡️ УСТАНАВЛИВАЕМ HTTPONLY COOKIE с refresh token
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            max_age=30 * 24 * 60 * 60,  # 30 дней в секундах
            httponly=True,  # Недоступен для JavaScript
            secure=True,    # Только через HTTPS
            samesite="lax"  # Защита от CSRF
        )
        print(f"🔐 [telegram-auth] Установлен HttpOnly cookie с refresh token")
        
        return {
            "user": user_data,
            "token": access_token,
            "refreshToken": refresh_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )

@router.post("/google")
async def authenticate_google(
    google_data: dict,
    response: Response,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Авторизация через Google OAuth
    """
    try:
        import httpx
        
        code = google_data.get('code')
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Отсутствует код авторизации Google"
            )
        
        # Определяем redirect_uri для Google OAuth
        redirect_uri = "https://supboardapp.ru/auth/google/callback"
        
        # Google OAuth требует client_secret для обмена кода на токен
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri
        }
        
        print(f"🚀 Отправляем запрос на получение токена Google...")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            token_response = await client.post(token_url, data=token_data)
            
            if token_response.status_code != 200:
                error_detail = token_response.text if token_response.text else "Неизвестная ошибка"
                print(f"Google OAuth error: {token_response.status_code} - {error_detail}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка получения токена от Google: {error_detail}"
                )
            
            token_info = token_response.json()
            google_access_token = token_info.get('access_token')
            
            if not google_access_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Не удалось получить токен доступа"
                )
            
            # Получаем информацию о пользователе
            print(f"🔍 Получаем данные пользователя от Google...")
            user_info_url = f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={google_access_token}"
            user_response = await client.get(user_info_url)
            
            if user_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ошибка получения данных пользователя от Google"
                )
            
            user_info = user_response.json()
            print(f"Google user info: {user_info}")
        
        # Извлекаем данные пользователя
        google_id = user_info.get('id')
        email = user_info.get('email')
        name = user_info.get('name', '')
        picture = user_info.get('picture')
        
        print(f"Extracted data: google_id={google_id}, email={email}, name={name}")
        
        if not google_id or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неполные данные от Google"
            )
        
        # Ищем или создаем пользователя
        # Используем сокращенный Google ID как телефон (последние 10 цифр)
        short_google_id = str(google_id)[-10:]  # Берем последние 10 цифр
        phone = f"+g{short_google_id}"  # Временный телефон для Google пользователей (макс 12 символов)
        
        print(f"Looking for existing user with phone: {phone}")
        existing_user = await user_crud.get_user_by_phone(db, phone=phone)
        print(f"Existing user found: {existing_user is not None}")
        
        if existing_user:
            user = existing_user
            print(f"Using existing user: {user.id}")
        else:
            print("Creating new user...")
            user_data = UserCreateOAuth(
                name=name or email.split('@')[0],
                phone=phone,
                email=email
            )
            print(f"User data: {user_data}")
            user = await user_crud.create_user(db, user_in=user_data)
            print(f"Created new user: {user.id}")
        
        # Генерируем токены
        access_token = f"google_token_{user.id}_{int(datetime.now().timestamp())}"
        refresh_token = f"refresh_{user.id}_{int(datetime.now().timestamp())}"
        
        print(f"Generated tokens for user {user.id}")
        
        # Формируем ответ
        user_data = {
            "id": str(user.id),
            "name": user.name,
            "email": email,
            "avatar": picture,
            "role": "admin",  # Google пользователи - это бизнесмены
            "provider": "google",
            "providerId": str(google_id),
            "createdAt": user.created_at.isoformat() if user.created_at else "",
            "updatedAt": user.updated_at.isoformat() if user.updated_at else ""
        }
        
        print(f"Returning user data: {user_data}")
        
        # 🛡️ УСТАНАВЛИВАЕМ HTTPONLY COOKIE с refresh token
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            max_age=30 * 24 * 60 * 60,  # 30 дней в секундах
            httponly=True,  # Недоступен для JavaScript
            secure=True,    # Только через HTTPS
            samesite="lax"  # Защита от CSRF
        )
        print(f"🔐 [google-auth] Установлен HttpOnly cookie с refresh token")
        
        return {
            "user": user_data,
            "token": access_token,
            "refreshToken": refresh_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Exception in Google OAuth: {str(e)}")
        print(f"Exception type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера при авторизации Google: {str(e)}"
        )

@router.post("/vk")
async def authenticate_vk(
    vk_data: dict,
    response: Response,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Авторизация через VK ID
    """
    try:
        print(f"Received VK data: {vk_data}")
        
        # VK ID SDK возвращает id_token, который нужно декодировать
        id_token = vk_data.get('id_token')
        if not id_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Отсутствует id_token в данных VK"
            )
        
        # Получаем access_token для запросов к VK API
        access_token = vk_data.get('access_token')
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Отсутствует access_token в данных VK"
            )

        # Декодируем JWT токен для получения user_id
        import jwt
        try:
            decoded_token = jwt.decode(id_token, options={"verify_signature": False})
            print(f"Decoded VK token: {decoded_token}")
            user_id = decoded_token.get('sub')
        except Exception as jwt_error:
            print(f"JWT decode error: {jwt_error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ошибка декодирования VK токена"
            )

        # Получаем дополнительную информацию о пользователе, переданную с фронтенда
        user_info = vk_data.get('user_info')
        print(f"VK user_info from frontend: {user_info}")
        
        if user_info:
            first_name = user_info.get('first_name', 'VK User')
            last_name = user_info.get('last_name', str(user_id))
            avatar = user_info.get('avatar')
            phone = user_info.get('phone')
            email = user_info.get('email')
            print(f"Using user data from VK ID SDK: {first_name} {last_name}")
        else:
            # Fallback к базовым данным
            print(f"No user_info from frontend, using basic data for user_id: {user_id}")
            first_name = f"VK User"
            last_name = str(user_id)
            avatar = None
            phone = None
            email = None
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверные данные VK"
            )
        
        # Формируем имя пользователя
        name = f"{first_name} {last_name}".strip() or f"VK User {user_id}"
        
        # Ищем или создаем пользователя
        # Если есть номер телефона из VK, используем его, иначе создаем временный
        if phone and phone.startswith('+'):
            user_phone = phone
        else:
            # Используем VK ID как временный телефон
            user_phone = f"+v{user_id}"  # Временный телефон для VK пользователей
        
        print(f"Looking for existing VK client with phone: {user_phone}")
        existing_user = await user_crud.get_user_by_phone(db, phone=user_phone)
        print(f"Existing VK user found: {existing_user is not None}")
        
        if existing_user:
            user = existing_user
            print(f"Using existing VK user: {user.id}")
            # Обновляем данные пользователя если получили новую информацию из VK
            updated = False
            if avatar and not existing_user.avatar:
                existing_user.avatar = avatar
                updated = True
            
            # Обновляем имя если получили реальные данные из VK
            if name != f"VK User {user_id}" and existing_user.name == f"VK User {user_id}":
                existing_user.name = name
                updated = True
                
            # Обновляем email если получили данные из VK
            if email and not existing_user.email:
                existing_user.email = email
                updated = True
                
            if updated:
                await db.commit()
                await db.refresh(existing_user)
        else:
            print("Creating new VK user...")
            user_data = UserCreateOAuth(
                name=name,
                phone=user_phone,
                email=email,
                avatar=avatar
            )
            print(f"VK User data: {user_data}")
            user = await user_crud.create_user(db, user_in=user_data)
            print(f"Created new VK user: {user.id}")
        
        # Генерируем токены
        access_token = f"vk_token_{user.id}_{int(datetime.now().timestamp())}"
        refresh_token = f"refresh_{user.id}_{int(datetime.now().timestamp())}"
        
        print(f"Generated tokens for VK user {user.id}")
        
        # Обновляем данные в базе
        await db.refresh(user)
        
        # Формируем ответ
        user_data = {
            "id": str(user.id),
            "name": user.name,
            "email": user.email or email,
            "phone": user.phone,
            "avatar": user.avatar or avatar,
            "role": "admin",  # VK пользователи - это бизнесмены
            "provider": "vk",
            "providerId": str(user_id),
            "createdAt": user.created_at.isoformat() if user.created_at else "",
            "updatedAt": user.updated_at.isoformat() if user.updated_at else ""
        }
        
        print(f"Returning VK user data: {user_data}")
        
        # 🛡️ УСТАНАВЛИВАЕМ HTTPONLY COOKIE с refresh token
        # Используем JSONResponse для правильной установки cookies
        from fastapi.responses import JSONResponse
        
        response_data = {
            "user": user_data,
            "token": access_token,
            "refreshToken": refresh_token
        }
        
        json_response = JSONResponse(content=response_data)
        json_response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            max_age=30 * 24 * 60 * 60,  # 30 дней в секундах
            httponly=True,  # Недоступен для JavaScript
            secure=True,    # Только через HTTPS
            samesite="lax"  # Защита от CSRF
        )
        print(f"🔐 [vk-auth] Установлен HttpOnly cookie с refresh token")
        
        return json_response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Exception in VK OAuth: {str(e)}")
        print(f"Exception type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера при авторизации VK: {str(e)}"
        )

@router.post("/register")
async def register_user(
    request: RegisterRequest,
    response: Response,
    http_request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """Регистрация нового пользователя с номером телефона, паролем, именем и email"""
    try:
        # Очищаем номер телефона от форматирования для поиска в storage
        phone_digits = ''.join(filter(str.isdigit, request.phone))
        formatted_phone = f"+{phone_digits}"  # Добавляем определение formatted_phone
        logger.info(f"🔍 Регистрация пользователя с номером: {request.phone} (цифры: {phone_digits})")
        
        # Проверяем токен регистрации вместо SMS кода
        registration_token = request.registration_token
        logger.info(f"🔍 Проверяем токен регистрации: {registration_token[:16] if registration_token else 'None'}...")
        
        if not registration_token or registration_token not in registration_tokens_storage:
            logger.info(f"❌ Токен регистрации не найден")
            logger.info(f"🔍 Активные токены: {len(registration_tokens_storage)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Токен регистрации недействителен. Пожалуйста, подтвердите номер телефона заново."
            )
            
        token_data = registration_tokens_storage[registration_token]
        logger.info(f"🔍 Данные токена: phone={token_data.get('phone')}")
        
        # Проверяем что токен не истек
        if datetime.now() > token_data.get('expires_at'):
            logger.info(f"❌ Токен регистрации истек")
            del registration_tokens_storage[registration_token]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Токен регистрации истек. Пожалуйста, подтвердите номер телефона заново."
            )
            
        # Проверяем что номер телефона совпадает
        if token_data.get('phone') != formatted_phone:
            logger.info(f"❌ Номер телефона не совпадает с токеном: {formatted_phone} != {token_data.get('phone')}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Номер телефона не совпадает с подтвержденным."
            )
        
        # Проверяем, что пользователь с таким номером не существует
        existing_user = await user_crud.get_user_by_phone(db, phone=request.phone)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким номером телефона уже существует"
            )
        
        # Проверяем, что пользователь с таким email не существует
        existing_email = await user_crud.get_user_by_email(db, email=request.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )
        
        # 🔍 ДОПОЛНИТЕЛЬНЫЕ ЛОГИ ДЛЯ ОТЛАДКИ РЕГИСТРАЦИИ
        logger.info(f"🔍 [register] Исходный номер от клиента: '{request.phone}'")
        logger.info(f"🔍 [register] Очищенные цифры: '{phone_digits}'")
        logger.info(f"🔍 [register] Форматированный номер: '{formatted_phone}'")
        logger.info(f"🔍 [register] Номер который будем сохранять в БД: '{request.phone}'")
        
        # Создаем нового пользователя (бизнес-владельца)
        user_data = UserCreate(
            name=request.name,
            phone=request.phone,  # Сохраняем в исходном формате!
            email=request.email,
            password=request.password  # CRUD сам захеширует пароль
        )
        
        client = await user_crud.create_user(db, user=user_data)
        
        # 🔍 ПРОВЕРЯЕМ ЧТО СОХРАНИЛОСЬ В БД
        logger.info(f"🔍 [register] Сохранено в БД: ID={client.id}, Phone='{client.phone}', Name='{client.name}'")
        
        # Сразу сохраняем все данные клиента в переменные (избегаем greenlet проблем)
        client_id = client.id
        client_phone = client.phone
        client_name = client.name
        client_email = client.email
        client_avatar = getattr(client, 'avatar', None)
        client_created_at = client.created_at.isoformat() if hasattr(client, 'created_at') and client.created_at else ""
        client_updated_at = client.updated_at.isoformat() if hasattr(client, 'updated_at') and client.updated_at else ""
        
        logger.info(f"✅ [register] Клиент создан: ID={client_id}")
        
        # Удаляем токен регистрации после успешной регистрации
        if registration_token in registration_tokens_storage:
            del registration_tokens_storage[registration_token]
            logger.info(f"✅ Удален токен регистрации после успешной регистрации")
        
        # 🛡️ СОЗДАЕМ SECURE SESSION (как в verify-sms-code)
        refresh_token = security_service.generate_secure_token(32)
        logger.info(f"🔍 [register] Создаем secure session для user_id: {client_id}")
        
        try:
            # Создаем сессию устройства
            device_session = await security_service.create_secure_session(
                db=db,
                user=client,
                request=http_request,
                refresh_token=refresh_token
            )
            logger.info(f"✅ [register] Создана secure session: ID={device_session.id}")
            
            # Обновляем информацию о последнем входе пользователя
            try:
                await security_service.update_user_login_info(db, client, http_request)
                logger.info(f"✅ [register] Обновлена информация о входе пользователя")
            except Exception as login_info_error:
                logger.warning(f"⚠️ [register] Не удалось обновить информацию о входе: {login_info_error}")
                # Не критично, продолжаем
            
        except Exception as security_error:
            logger.error(f"❌ [register] Ошибка создания secure session: {security_error}")
            import traceback
            logger.error(f"❌ [register] Traceback: {traceback.format_exc()}")
            # Продолжаем с обычными токенами в случае ошибки
        
        # Генерируем правильный JWT access token
        access_token_data = {
            "sub": str(client_id),
            "phone": client_phone,
            "name": client_name,
            "provider": "registration"
        }
        access_token = create_access_token(data=access_token_data)
        
        # 🛡️ УСТАНАВЛИВАЕМ HTTPONLY COOKIE с refresh token
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            max_age=30 * 24 * 60 * 60,  # 30 дней в секундах
            httponly=True,  # Недоступен для JavaScript
            secure=True,    # Только через HTTPS
            samesite="lax"  # Защита от CSRF
        )
        logger.info(f"🔐 [register] Установлен HttpOnly cookie с refresh token")
        
        # Коммитим все изменения в БД в самом конце
        try:
            await db.commit()
            logger.info(f"✅ [register] Все изменения сохранены в БД")
        except Exception as commit_error:
            logger.warning(f"⚠️ [register] Проблема с коммитом БД: {commit_error}")
            # Не критично, продолжаем
        
        logger.info(f"Пользователь успешно зарегистрирован: {request.phone}")
        
        # Формируем ответ используя сохраненные переменные (избегаем greenlet ошибок)
        response_data = {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(client_id),
                "phone": client_phone,
                "name": client_name,
                "email": client_email,
                "avatar": client_avatar,
                "role": "user",
                "provider": "sms",
                "providerId": phone_digits,
                "createdAt": client_created_at,
                "updatedAt": client_updated_at
            },
            "refreshToken": refresh_token  # Оставляем в ответе для совместимости
        }
        logger.info(f"✅ [register] Ответ сформирован успешно")
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка регистрации пользователя: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Внутренняя ошибка сервера")

@router.post("/login")
async def login_user(
    login_data: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Вход пользователя по номеру телефона и паролю
    """
    try:
        logger.info(f"🔐 Попытка входа через пароль: {login_data.phone}")
        
        # Аутентификация пользователя с проверкой пароля
        user = await user_crud.authenticate_user(db, login_data.phone, login_data.password)
        
        if not user:
            logger.warning(f"❌ Неудачная попытка входа: {login_data.phone}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный номер телефона или пароль"
            )
        
        logger.info(f"✅ Успешная аутентификация: {user.name} (ID: {user.id})")
        
        # 🛡️ ГЕНЕРИРУЕМ DEVICE FINGERPRINT
        device_fingerprints = security_service.generate_flexible_fingerprint(request)
        device_fingerprint = device_fingerprints["strict"]
        ip_address = security_service.get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        
        # 🛡️ СОЗДАЕМ НОВУЮ SECURE SESSION
        refresh_token = security_service.generate_secure_token(32)
        device_session = await security_service.device_session_crud.create_session(
            db,
            user_id=user.id,
            device_fingerprint=device_fingerprint,
            refresh_token=refresh_token,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_hours=168  # 7 дней
        )
        logger.info(f"✅ [login] Создана новая сессия: ID={device_session.id}")
        
        # 🍪 УСТАНАВЛИВАЕМ HTTPONLY COOKIE с refresh token
        security_service.set_refresh_token_cookie(response, refresh_token)
        logger.info(f"✅ [login] HttpOnly cookie установлен")
        
        # Обновляем информацию о входе
        await user_crud.update_login_info(
            db, user.id, ip_address, user_agent, device_fingerprint
        )
        
        # Генерируем JWT access token
        access_token_data = {
            "sub": str(user.id),
            "phone": user.phone,
            "name": user.name,
            "provider": "password"
        }
        access_token = create_access_token(data=access_token_data)
        
        # Формируем ответ
        user_data = {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "avatar": user.avatar,
            "role": "user",
            "provider": "password",
            "providerId": None,
            "createdAt": user.created_at.isoformat() if user.created_at else "",
            "updatedAt": user.updated_at.isoformat() if user.updated_at else ""
        }
        
        logger.info(f"✅ Пользователь вошел через пароль: {user_data['name']}")
        
        return {
            "user": user_data,
            "token": access_token,
            "refreshToken": refresh_token  # Оставляем в ответе для совместимости
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка входа через пароль: {str(e)}")
        import traceback
        logger.error(f"❌ Полная трассировка: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера при входе"
        )

@router.post("/send-registration-sms-code")
async def send_registration_sms_code(
    sms_data: SMSCodeCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Отправляет 6-значный SMS код для регистрации
    """
    try:
        # Очищаем номер телефона от форматирования
        phone = ''.join(filter(str.isdigit, sms_data.phone))
        
        # Проверяем формат номера (должен начинаться с 7 и быть 11 цифр)
        if not phone.startswith('7') or len(phone) != 11:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат номера телефона"
            )
        
        # 🛡️ ПРОВЕРЯЕМ SMS RATE LIMIT для регистрации
        formatted_phone = f"+{phone}"
        rate_limit_result = await security_service.check_sms_rate_limit(db, formatted_phone)
        
        if not rate_limit_result["allowed"]:
            logger.warning(f"🚫 SMS rate limit превышен для регистрации {formatted_phone}: {rate_limit_result['requests_count']}/{rate_limit_result['max_requests']}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Превышен лимит SMS запросов. Попробуйте через {rate_limit_result['reset_at']} минут."
            )
        
        logger.info(f"✅ SMS rate limit OK для регистрации {formatted_phone}: {rate_limit_result['requests_count']}/{rate_limit_result['max_requests']}")
        
        # Генерируем 6-значный код для регистрации
        code = generate_registration_sms_code()
        
        # Сохраняем код с временем истечения (1 минута)
        expiry_time = datetime.now() + timedelta(minutes=1)
        sms_codes_storage[phone] = {
            'code': code,
            'expires_at': expiry_time,
            'attempts': 0,
            'type': 'registration'  # Помечаем как код регистрации
        }
        
        # Формируем сообщение
        message = f"Код регистрации SUBboards: {code}"
        
        # Отправляем SMS через SMS.ru
        success = send_sms_via_sms_ru(phone, message)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Ошибка отправки SMS"
            )
        
        return {
            "success": True,
            "message": "SMS код регистрации отправлен",
            "expires_in": 60  # 1 минута в секундах
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )

@router.post("/logout")
async def logout_user():
    """
    Логаут пользователя (простая заглушка)
    """
    return {"message": "Пользователь успешно вышел из системы"}

@router.post("/refresh")
async def refresh_access_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Обновляет access token используя refresh token из HttpOnly cookie
    """
    try:
        # Получаем refresh token из HttpOnly cookie
        refresh_token = request.cookies.get('refresh_token')
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Отсутствует refresh token в cookie"
            )
        
        # 🛡️ ВАЛИДИРУЕМ SECURE SESSION (менее строгая проверка для refresh)
        device_session, user = await security_service.validate_session(db, refresh_token, request, strict_fingerprint=False)
        
        if not device_session or not user:
            logger.warning(f"🚫 Недействительная сессия для refresh token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный refresh token"
            )
        
        logger.info(f"✅ Валидная сессия найдена: ID={device_session.id}, User={user.id}")
        
        # Обновляем время последнего использования сессии
        await security_service.device_session_crud.update_last_used(
            db, device_session.id, security_service.get_client_ip(request)
        )
        
        # 🔥 ИСПРАВЛЕНИЕ: Генерируем новый secure refresh token и обновляем в БД
        new_refresh_token = security_service.generate_secure_token(32)
        await security_service.device_session_crud.update_refresh_token(
            db, device_session.id, new_refresh_token
        )
        logger.info(f"✅ [refresh] Обновлен refresh token в БД для session {device_session.id}")
        
        # Генерируем новые JWT токены
        access_token_data = {
            "sub": str(user.id),
            "phone": user.phone,
            "name": user.name,
            "provider": "refresh"
        }
        new_access_token = create_access_token(data=access_token_data)
        
        # Формируем данные пользователя
        user_data = {
            "id": str(user.id),
            "name": user.name,
            "email": user.phone,
            "avatar": user.avatar,
            "role": "user",
            "provider": "sms",
            "providerId": str(user.id),
            "createdAt": user.created_at.isoformat() if user.created_at else "",
            "updatedAt": user.updated_at.isoformat() if user.updated_at else ""
        }
        
        # 🛡️ ОБНОВЛЯЕМ HTTPONLY COOKIE с новым refresh token
        response.set_cookie(
            key="refresh_token",
            value=new_refresh_token,
            max_age=30 * 24 * 60 * 60,  # 30 дней в секундах
            httponly=True,  # Недоступен для JavaScript
            secure=True,    # Только через HTTPS
            samesite="lax"  # Защита от CSRF
        )
        logger.info(f"🔐 [refresh] Обновлен HttpOnly cookie с новым refresh token")
        
        return {
            "user": user_data,
            "token": new_access_token,
            "refreshToken": new_refresh_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [refresh] Ошибка обновления токена: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )

# Функция для создания JWT токенов
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)  # ✅ Возвращаем нормальные 15 минут
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm="HS256")
    return encoded_jwt

@router.get("/device-sessions")
async def get_device_sessions(
    session_data: dict = Depends(require_valid_session),
    request: Request = None
):
    """
    Получить список всех device-сессий пользователя с определением текущей сессии
    """
    # Получаем данные из защищенной сессии
    user_id = session_data["user_id"]
    current_session_id = session_data["session_id"]
    db = session_data["db"]
    
    print(f"🔍 [device-sessions] Запрос сеансов для user_id: {user_id}")
    print(f"🔍 [device-sessions] Текущая сессия из middleware: ID={current_session_id}")
    
    # Получаем device-сессии
    from crud.device_session import CRUDDeviceSession
    crud = CRUDDeviceSession()
    sessions = await crud.get_active_sessions_for_user(db, user_id)
    
    print(f"🔍 [device-sessions] Найдено активных сеансов: {len(sessions)}")
    
    for session in sessions:
        is_current = session.id == current_session_id if current_session_id else False
        print(f"🔍 [device-sessions] Session ID: {session.id}, is_current: {is_current}")
    
    sessions_dict = [s.to_dict() for s in sessions]
    print(f"🔍 [device-sessions] Возвращаем данные: {sessions_dict}")
    print(f"🔍 [device-sessions] Current session ID: {current_session_id}")
    
    return {
        "sessions": sessions_dict,
        "current_session_id": current_session_id
    }

@router.post("/device-sessions/close-others")
async def close_other_device_sessions(
    session_data: dict = Depends(require_valid_session)
):
    """
    Завершить все device-сессии пользователя, кроме текущей
    """
    # Получаем данные из защищенной сессии
    user_id = session_data["user_id"]
    current_session_id = session_data["session_id"]
    db = session_data["db"]
    
    print(f"🔍 [close-others] Текущая сессия из middleware: ID={current_session_id}")
    
    # Удаляем все сессии кроме текущей
    from crud.device_session import CRUDDeviceSession
    crud = CRUDDeviceSession()
    count = await crud.revoke_all_sessions_for_user(db, user_id, except_session_id=current_session_id)
    print(f"🗑️ [close-others] Удалено сессий: {count}")
    
    return {"deleted": count}

@router.delete("/device-sessions/{session_id}")
async def delete_device_session(
    session_id: int = Path(..., description="ID сессии"),
    session_data: dict = Depends(require_valid_session),
    request: Request = None,
    response: Response = None
):
    """
    Завершить (отозвать) конкретную device-сессию пользователя
    """
    # Получаем данные из защищенной сессии
    user_id = session_data["user_id"]
    current_session_id = session_data["session_id"]
    db = session_data["db"]
    
    print(f"🗑️ [delete-session] Удаляем сессию {session_id} для user_id: {user_id}")
    
    # Проверяем, что сессия принадлежит пользователю
    from crud.device_session import CRUDDeviceSession
    crud = CRUDDeviceSession()
    sessions = await crud.get_active_sessions_for_user(db, user_id)
    
    print(f"🔍 [delete-session] Найдено активных сеансов: {len(sessions)}")
    for session in sessions:
        print(f"🔍 [delete-session] Session ID: {session.id}")
    
    if not any(s.id == session_id for s in sessions):
        print(f"❌ [delete-session] Сессия {session_id} не найдена среди активных")
        raise HTTPException(status_code=404, detail="Сессия не найдена или не принадлежит пользователю")
    
    # 🛡️ ПРОВЕРЯЕМ ЯВЛЯЕТСЯ ЛИ ЭТА СЕССИЯ ТЕКУЩЕЙ
    is_current_session = (current_session_id == session_id)
    
    if is_current_session:
        print(f"⚠️ [delete-session] Удаляется ТЕКУЩАЯ сессия - очищаем HttpOnly cookie")
    
    print(f"✅ [delete-session] Сессия {session_id} найдена, удаляем из БД...")
    ok = await crud.revoke_session(db, session_id)
    print(f"✅ [delete-session] Результат удаления: {ok}")
    
    # 🛡️ ОЧИЩАЕМ HTTPONLY COOKIE ЕСЛИ ЭТО ТЕКУЩАЯ СЕССИЯ
    if is_current_session and response:
        response.set_cookie(
            key="refresh_token",
            value="",
            max_age=0,  # Немедленно удаляем
            httponly=True,
            secure=True,
            samesite="lax"
        )
        print(f"🧹 [delete-session] HttpOnly cookie очищен для удаленной текущей сессии")
    
    return {"deleted": ok, "was_current_session": is_current_session}

@router.patch("/device-sessions/settings")
async def update_device_sessions_settings(
    days: int = Body(..., embed=True, ge=1, le=365, description="Сколько дней хранить неактивные сессии"),
):
    """
    Изменить срок хранения неактивных device-сессий (автоудаление)
    """
    auto_cleanup_settings["days"] = days
    return {"auto_cleanup_days": days}

@router.post("/check-device-trust")
async def check_device_trust(
    trust_data: dict,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Проверяет является ли текущее устройство доверенным для автоматического входа
    """
    try:
        phone = trust_data.get('phone')
        if not phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Отсутствует номер телефона"
            )
        
        # Ищем клиента по номеру телефона
        client = await user_crud.get_user_by_phone(db, phone=phone)
        if not client:
            return {
                "trusted": False,
                "reason": "user_not_found",
                "message": "Пользователь не найден"
            }
        
        # 🛡️ ПРОВЕРЯЕМ HTTPONLY COOKIE с refresh token
        refresh_token_from_cookie = security_service.get_refresh_token_from_cookie(request)
        if not refresh_token_from_cookie:
            return {
                "trusted": False,
                "reason": "no_refresh_token",
                "message": "Отсутствует refresh token в cookie"
            }
        
        # 🛡️ ВАЛИДИРУЕМ СЕССИЮ С ПРОВЕРКОЙ DEVICE FINGERPRINT
        session, validated_client = await security_service.validate_session(
            db, refresh_token_from_cookie, request, strict_fingerprint=False  # Менее строгая проверка для check-device-trust
        )
        
        if not session or not validated_client:
            return {
                "trusted": False,
                "reason": "invalid_session",
                "message": "Сессия не найдена или недействительна"
            }
        
        if session.user_id != client.id:
            return {
                "trusted": False,
                "reason": "session_mismatch",
                "message": "Сессия принадлежит другому пользователю"
            }
        
        # ✅ УСТРОЙСТВО ДОВЕРЕННОЕ - есть валидная сессия
        logger.info(f"✅ Доверенное устройство для {phone}: session_id={session.id}")
        
        return {
            "trusted": True,
            "reason": "valid_session",
            "message": "Устройство доверенное",
            "session_id": session.id,
            "device_info": {
                "browser": session.browser_name,
                "os": session.os_name,
                "device": session.device_type,
                "last_used": session.last_used_at.isoformat() if session.last_used_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка проверки Device Trust: {e}")
        return {
            "trusted": False,
            "reason": "server_error",
            "message": f"Ошибка сервера: {str(e)}"
        }

@router.post("/auto-login")
async def auto_login_trusted_device(
    login_data: dict,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Автоматический вход для доверенного устройства используя HttpOnly cookie
    """
    try:
        phone = login_data.get('phone')
        if not phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Отсутствует номер телефона"
            )
        
        # Ищем клиента по номеру телефона
        client = await user_crud.get_user_by_phone(db, phone=phone)
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        # 🛡️ ВАЛИДИРУЕМ REFRESH TOKEN ИЗ HTTPONLY COOKIE
        refresh_token_from_cookie = security_service.get_refresh_token_from_cookie(request)
        if not refresh_token_from_cookie:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Отсутствует refresh token - требуется SMS код"
            )
        
        # 🛡️ ВАЛИДИРУЕМ СЕССИЮ (используем ту же проверку что и в check-device-trust)
        session, validated_client = await security_service.validate_session(
            db, refresh_token_from_cookie, request, strict_fingerprint=False  # Мягкая проверка как в check-device-trust
        )
        
        if not session or not validated_client or session.user_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Сессия недействительна - требуется SMS код"
            )
        
        # ✅ УСТРОЙСТВО ДОВЕРЕННОЕ - СОЗДАЕМ НОВЫЕ ТОКЕНЫ
        logger.info(f"✅ Автоматический вход для доверенного устройства: {phone}")
        
        # Генерируем новый JWT access token
        access_token_data = {
            "sub": str(client.id),
            "phone": client.phone,
            "name": client.name,
            "provider": "auto_login"
        }
        access_token = create_access_token(data=access_token_data)
        
        # Генерируем новый refresh token и обновляем сессию
        new_refresh_token = security_service.generate_secure_token(32)
        from crud.device_session import CRUDDeviceSession
        crud = CRUDDeviceSession()
        await crud.update_refresh_token(db, session.id, new_refresh_token)
        
        # Формируем данные пользователя
        user_data = {
            "id": str(client.id),
            "name": client.name,
            "email": client.phone,
            "avatar": client.avatar,
            "role": "user",
            "provider": "auto_login",
            "providerId": str(client.id),
            "createdAt": client.created_at.isoformat() if client.created_at else "",
            "updatedAt": client.updated_at.isoformat() if client.updated_at else ""
        }
        
        # 🛡️ ОБНОВЛЯЕМ HTTPONLY COOKIE с новым refresh token
        response.set_cookie(
            key="refresh_token",
            value=new_refresh_token,
            max_age=30 * 24 * 60 * 60,  # 30 дней в секундах
            httponly=True,  # Недоступен для JavaScript
            secure=True,    # Только через HTTPS
            samesite="lax"  # Защита от CSRF
        )
        
        logger.info(f"🔐 [auto-login] Обновлен HttpOnly cookie для доверенного устройства")
        
        return {
            "user": user_data,
            "token": access_token,
            "refreshToken": new_refresh_token,  # Для совместимости
            "login_method": "auto_trusted_device"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка автоматического входа: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )

@router.post("/soft-logout")
async def soft_logout_user(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Мягкий выход - очищает токены но сохраняет device session для Device Trust
    """
    try:
        # 🛡️ ПОЛУЧАЕМ REFRESH TOKEN ИЗ HTTPONLY COOKIE
        refresh_token_from_cookie = security_service.get_refresh_token_from_cookie(request)
        if not refresh_token_from_cookie:
            logger.info("⚠️ Soft logout: refresh token отсутствует")
            # Все равно очищаем cookie
            response.set_cookie(
                key="refresh_token",
                value="",
                max_age=0,
                httponly=True,
                secure=True,
                samesite="lax"
            )
            return {"message": "Выход выполнен (токен отсутствовал)"}
        
        # Находим device session
        from crud.device_session import CRUDDeviceSession
        crud = CRUDDeviceSession()
        current_session = await crud.get_session_by_refresh_token(db, refresh_token_from_cookie)
        
        if current_session:
            # 🔄 ОБНОВЛЯЕМ REFRESH TOKEN (инвалидируем старый)
            new_refresh_token = security_service.generate_secure_token(32)
            await crud.update_refresh_token(db, current_session.id, new_refresh_token)
            logger.info(f"✅ Soft logout: refresh token обновлен для session {current_session.id}")
            
            # 🛡️ УСТАНАВЛИВАЕМ НОВЫЙ HTTPONLY COOKIE (НЕ ОЧИЩАЕМ!)
            response.set_cookie(
                key="refresh_token",
                value=new_refresh_token,
                max_age=30 * 24 * 60 * 60,  # 30 дней
                httponly=True,
                secure=True,
                samesite="lax"
            )
            logger.info(f"🔐 Soft logout: новый HttpOnly cookie установлен")
        else:
            logger.warning("⚠️ Soft logout: device session не найдена - очищаем cookie")
            # Только если сессия не найдена - очищаем cookie
            response.set_cookie(
                key="refresh_token",
                value="",
                max_age=0,
                httponly=True,
                secure=True,
                samesite="lax"
            )
        
        return {"message": "Мягкий выход выполнен - устройство остается доверенным"}
        
    except Exception as e:
        logger.error(f"❌ Ошибка soft logout: {e}")
        # В случае ошибки все равно очищаем cookie
        response.set_cookie(
            key="refresh_token",
            value="",
            max_age=0,
            httponly=True,
            secure=True,
            samesite="lax"
        )
        return {"message": "Выход выполнен с ошибкой"}

@router.post("/debug-device-fingerprint")
async def debug_device_fingerprint(
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """
    🔍 ДИАГНОСТИЧЕСКИЙ ENDPOINT - анализирует device fingerprint и сессии
    """
    try:
        # Генерируем все типы fingerprint
        device_fingerprints = security_service.generate_flexible_fingerprint(request)
        ip_address = security_service.get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        
        # Ищем все сессии с таким же fingerprint
        from crud.device_session import CRUDDeviceSession
        device_crud = CRUDDeviceSession()
        
        # Ищем ВСЕ сессии по loose fingerprint (включая неактивные)
        all_sessions = await device_crud.get_sessions_by_fingerprint(
            db, device_fingerprints["loose"], include_inactive=True
        )
        active_sessions = await device_crud.get_sessions_by_fingerprint(
            db, device_fingerprints["loose"], include_inactive=False
        )
        
        # Получаем refresh token из cookie
        refresh_token = request.cookies.get("refresh_token")
        
        # Группируем по пользователям
        sessions_by_user = {}
        for session in all_sessions:
            user_id = session.user_id
            if user_id not in sessions_by_user:
                sessions_by_user[user_id] = []
            
            # Проверяем, совпадает ли refresh token
            token_matches = False
            if refresh_token and session.refresh_token_hash:
                import bcrypt
                try:
                    token_matches = bcrypt.checkpw(
                        refresh_token.encode('utf-8'), 
                        session.refresh_token_hash.encode('utf-8')
                    )
                except:
                    token_matches = False
            
            sessions_by_user[user_id].append({
                "session_id": session.id,
                "is_active": session.is_active,
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "last_used_at": session.last_used_at.isoformat() if session.last_used_at else None,
                "expires_at": session.expires_at.isoformat() if session.expires_at else None,
                "browser": session.browser_name,
                "os": session.os_name,
                "device_type": session.device_type,
                "refresh_token_hash": session.refresh_token_hash[:10] + "..." if session.refresh_token_hash else None,
                "current_refresh_token_matches": token_matches
            })
        
        # Получаем информации о пользователях
        users_info = {}
        for user_id in sessions_by_user.keys():
            user = await user_crud.get_user(db, user_id)
            if user:
                users_info[user_id] = {
                    "name": user.name,
                    "phone": user.phone,
                    "email": user.email
                }
        
        return {
            "current_request": {
                "ip_address": ip_address,
                "user_agent": user_agent,
                "fingerprints": {
                    "strict": device_fingerprints["strict"][:16] + "...",
                    "loose": device_fingerprints["loose"][:16] + "...", 
                    "very_loose": device_fingerprints["very_loose"][:16] + "..."
                },
                "has_refresh_token": bool(refresh_token),
                "refresh_token_preview": refresh_token[:10] + "..." if refresh_token else None
            },
            "sessions_analysis": {
                "total_sessions_all": len(all_sessions),
                "total_sessions_active": len(active_sessions),
                "unique_users_count": len(sessions_by_user),
                "sessions_by_user": sessions_by_user,
                "users_info": users_info
            },
            "problem_analysis": {
                "multiple_users_same_device": len(sessions_by_user) > 1,
                "sessions_deactivated": len(all_sessions) > len(active_sessions),
                "explanation": "Если multiple_users_same_device = true и sessions_deactivated = true, то при входе нового пользователя старые сессии деактивируются"
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка диагностики device fingerprint: {e}")
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }
