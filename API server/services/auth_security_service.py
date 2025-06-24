"""
Сервис безопасности для аутентификации
Реализует принципы SOLID, DRY, KISS
"""

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, Request, status
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
import hashlib
import secrets
import jwt
import logging
import re
import ipaddress
from passlib.context import CryptContext

# Импорты для расширенной аналитики
try:
    from user_agents import parse as parse_user_agent
    USER_AGENTS_AVAILABLE = True
except ImportError:
    USER_AGENTS_AVAILABLE = False
    
try:
    import geoip2.database
    import geoip2.errors
    GEOIP_AVAILABLE = True
except ImportError:
    GEOIP_AVAILABLE = False

# Локальные импорты
from models.security import DeviceSession, RateLimitEntry, BlockedIP, SecurityLog
from models.user import User
from crud.device_session import CRUDDeviceSession
from crud.user import user_crud
from crud.rate_limit import CRUDRateLimit
from core.config import settings

# Настройка логирования
logger = logging.getLogger(__name__)

# === КОНСТАНТЫ БЕЗОПАСНОСТИ ===
SECURITY_CONSTANTS = {
    "MAX_FAILED_LOGINS": 5,
    "LOGIN_LOCKOUT_MINUTES": 15,
    "SMS_RATE_LIMIT_PER_HOUR": 5,
    "API_RATE_LIMIT_PER_MINUTE": 60,
    "SESSION_LIFETIME_HOURS": 168,  # 7 дней
    "MAX_SESSIONS_PER_USER": 5,
    "DEVICE_FINGERPRINT_TOLERANCE": 0.8
}

# === CUSTOM EXCEPTIONS ===

class SecurityViolationError(Exception):
    """Исключение для нарушений безопасности"""
    def __init__(self, message: str, violation_type: str, details: Dict[str, Any] = None):
        super().__init__(message)
        self.violation_type = violation_type
        self.details = details or {}


class AuthSecurityService:
    """
    Сервис безопасности для аутентификации
    
    Принципы SOLID:
    - Single Responsibility: отвечает только за безопасность аутентификации
    - Open/Closed: можно расширять через наследование
    - Liskov Substitution: может быть заменен на другую реализацию
    - Interface Segregation: методы сгруппированы по функциям
    - Dependency Inversion: зависит от абстракций (CRUD), не от конкретных реализаций
    """

    def __init__(self):
        self.device_session_crud = CRUDDeviceSession()
        self.user_crud = user_crud
        self.rate_limit_crud = CRUDRateLimit()
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        # Настройки безопасности
        self.MAX_FAILED_LOGINS = SECURITY_CONSTANTS["MAX_FAILED_LOGINS"]
        self.LOGIN_LOCKOUT_MINUTES = SECURITY_CONSTANTS["LOGIN_LOCKOUT_MINUTES"]
        self.SMS_RATE_LIMIT_PER_HOUR = SECURITY_CONSTANTS["SMS_RATE_LIMIT_PER_HOUR"]
        self.API_RATE_LIMIT_PER_MINUTE = SECURITY_CONSTANTS["API_RATE_LIMIT_PER_MINUTE"]
        self.SESSION_LIFETIME_HOURS = SECURITY_CONSTANTS["SESSION_LIFETIME_HOURS"]
        self.MAX_SESSIONS_PER_USER = SECURITY_CONSTANTS["MAX_SESSIONS_PER_USER"]
        self.DEVICE_FINGERPRINT_TOLERANCE = SECURITY_CONSTANTS["DEVICE_FINGERPRINT_TOLERANCE"]
        
        # GeoIP база данных (опционально)
        self.geoip_reader = None
        if GEOIP_AVAILABLE:
            try:
                # В production нужно скачать GeoLite2-City.mmdb
                self.geoip_reader = geoip2.database.Reader('GeoLite2-City.mmdb')
            except Exception as e:
                logger.warning(f"GeoIP база недоступна: {e}")

    # ========== DEVICE FINGERPRINTING ==========
    
    def generate_device_fingerprint(
        self, 
        request: Request,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Генерирует отпечаток устройства на основе заголовков HTTP
        
        KISS: простой но надежный алгоритм
        """
        # Базовые данные
        user_agent = request.headers.get("user-agent", "")
        accept_language = request.headers.get("accept-language", "")
        accept_encoding = request.headers.get("accept-encoding", "")
        
        # IP адрес (может изменяться, поэтому используем с осторожностью)
        ip_address = self.get_client_ip(request)
        
        # Дополнительные данные из тела запроса (если есть)
        fingerprint_data = f"{user_agent}:{accept_language}:{accept_encoding}"
        
        if additional_data:
            # Сортируем ключи для стабильности
            for key in sorted(additional_data.keys()):
                fingerprint_data += f":{key}={additional_data[key]}"
        
        # Хешируем итоговый отпечаток
        return hashlib.sha256(fingerprint_data.encode()).hexdigest()

    def generate_flexible_fingerprint(
        self, 
        request: Request,
        tolerance_level: str = "strict"
    ) -> Dict[str, str]:
        """
        Генерирует несколько уровней отпечатков для гибкой проверки
        
        YAGNI: Добавлено только то, что нужно для работы с мобильными устройствами
        """
        user_agent = request.headers.get("user-agent", "")
        accept_language = request.headers.get("accept-language", "")
        accept_encoding = request.headers.get("accept-encoding", "")
        
        # Strict: полный отпечаток (для стационарных устройств)
        strict_data = f"{user_agent}:{accept_language}:{accept_encoding}"
        strict_fingerprint = hashlib.sha256(strict_data.encode()).hexdigest()
        
        # Loose: только основные браузерные данные (для мобильных)
        # Убираем версии браузера, которые могут автоматически обновляться
        user_agent_simplified = re.sub(r'[\d.]+', '', user_agent)  # Убираем версии
        loose_data = f"{user_agent_simplified}:{accept_language}"
        loose_fingerprint = hashlib.sha256(loose_data.encode()).hexdigest()
        
        # Very loose: только тип браузера и язык (для нестабильных сетей)
        browser_family = self._extract_browser_family(user_agent)
        very_loose_data = f"{browser_family}:{accept_language.split(',')[0] if accept_language else ''}"
        very_loose_fingerprint = hashlib.sha256(very_loose_data.encode()).hexdigest()
        
        return {
            "strict": strict_fingerprint,
            "loose": loose_fingerprint,
            "very_loose": very_loose_fingerprint
        }

    def _extract_browser_family(self, user_agent: str) -> str:
        """Извлекает семейство браузера без версии"""
        if "Chrome" in user_agent:
            return "Chrome"
        elif "Firefox" in user_agent:
            return "Firefox"
        elif "Safari" in user_agent and "Chrome" not in user_agent:
            return "Safari"
        elif "Edge" in user_agent:
            return "Edge"
        else:
            return "Other"

    async def validate_device_fingerprint(
        self,
        db: AsyncSession,
        session: DeviceSession,
        request: Request,
        strict_mode: bool = True
    ) -> Dict[str, Any]:
        """
        Валидирует отпечаток устройства с адаптивным подходом
        
        SOLID: отдельная ответственность за валидацию fingerprint
        """
        # Генерируем текущие отпечатки
        current_fingerprints = self.generate_flexible_fingerprint(request)
        stored_fingerprint = session.device_fingerprint
        
        # Проверяем разные уровни соответствия
        strict_match = current_fingerprints["strict"] == stored_fingerprint
        loose_match = current_fingerprints["loose"] == stored_fingerprint
        very_loose_match = current_fingerprints["very_loose"] == stored_fingerprint
        
        logger.info(f"Fingerprint validation - Strict: {strict_match}, Loose: {loose_match}, Very loose: {very_loose_match}")
        
        # Логика принятия решений
        if strict_match:
            return {
                "action": "allow",
                "risk_level": "low",
                "match_type": "strict",
                "details": {"reason": "Exact fingerprint match"}
            }
        elif loose_match and not strict_mode:
            return {
                "action": "allow", 
                "risk_level": "medium",
                "match_type": "loose",
                "details": {"reason": "Loose fingerprint match (mobile compatible)"}
            }
        elif very_loose_match and not strict_mode:
            return {
                "action": "warn",
                "risk_level": "medium",
                "match_type": "very_loose", 
                "details": {"reason": "Very loose match - possible network change"}
            }
        else:
            # Полное несоответствие
            risk_level = "high" if strict_mode else "medium"
            action = "block" if strict_mode else "warn"
            
            return {
                "action": action,
                "risk_level": risk_level,
                "match_type": "none",
                "details": {
                    "reason": "Fingerprint mismatch",
                    "stored_fingerprint": stored_fingerprint[:16] + "...",
                    "current_strict": current_fingerprints["strict"][:16] + "...",
                    "current_loose": current_fingerprints["loose"][:16] + "..."
                }
            }

    # ========== DEVICE INFO PARSING ==========
    
    def parse_device_info(self, user_agent: Optional[str]) -> Dict[str, Optional[str]]:
        """
        Парсит User-Agent для извлечения информации об устройстве
        
        DRY: переиспользуется в разных местах
        """
        if not user_agent:
            return {"browser": None, "os": None, "device_type": None}
        
        # Определяем браузер
        browser = "Unknown"
        if "Chrome" in user_agent and "Edg" not in user_agent:
            browser = "Chrome"
        elif "Firefox" in user_agent:
            browser = "Firefox"
        elif "Safari" in user_agent and "Chrome" not in user_agent:
            browser = "Safari"
        elif "Edg" in user_agent:
            browser = "Edge"
        elif "Opera" in user_agent or "OPR" in user_agent:
            browser = "Opera"
        
        # Определяем ОС
        os_name = "Unknown"
        if "Windows NT" in user_agent:
            if "Windows NT 10.0" in user_agent:
                os_name = "Windows 10/11"
            elif "Windows NT 6.3" in user_agent:
                os_name = "Windows 8.1"
            elif "Windows NT 6.1" in user_agent:
                os_name = "Windows 7"
            else:
                os_name = "Windows"
        elif "Macintosh" in user_agent or "Mac OS X" in user_agent:
            os_name = "macOS"
        elif "Linux" in user_agent and "Android" not in user_agent:
            os_name = "Linux"
        elif "Android" in user_agent:
            # Извлекаем версию Android
            android_match = re.search(r'Android (\d+(?:\.\d+)?)', user_agent)
            if android_match:
                os_name = f"Android {android_match.group(1)}"
            else:
                os_name = "Android"
        elif "iPhone" in user_agent or "iPad" in user_agent:
            # Извлекаем версию iOS
            ios_match = re.search(r'OS (\d+(?:_\d+)?)', user_agent)
            if ios_match:
                ios_version = ios_match.group(1).replace('_', '.')
                os_name = f"iOS {ios_version}"
            else:
                os_name = "iOS"
        
        # Определяем тип устройства
        device_type = "Desktop"
        if "Mobile" in user_agent or "Android" in user_agent and "Mobile" in user_agent:
            device_type = "Mobile"
        elif "Tablet" in user_agent or "iPad" in user_agent:
            device_type = "Tablet"
        elif "iPhone" in user_agent:
            device_type = "iPhone"
        
        return {
            "browser": browser,
            "os": os_name,
            "device_type": device_type
        }

    # ========== GEO LOCATION ==========
    
    def get_location_info(self, ip_address: str) -> Dict[str, Optional[str]]:
        """
        Получает геолокацию по IP адресу
        
        YAGNI: минимальная реализация без внешних сервисов
        """
        # Заглушка для локальных/частных IP
        try:
            ip_obj = ipaddress.ip_address(ip_address)
            if ip_obj.is_private or ip_obj.is_loopback:
                return {"country": None, "city": None}
        except ValueError:
            return {"country": None, "city": None}
        
        # TODO: Интеграция с MaxMind GeoIP2 или другим сервисом
        # Пока возвращаем заглушку
        return {"country": None, "city": None}

    # ========== RATE LIMITING ==========
    
    async def check_sms_rate_limit(
        self, 
        db: AsyncSession, 
        phone: str
    ) -> Dict[str, Any]:
        """
        Проверяет лимит SMS для номера телефона
        
        SOLID: отдельная ответственность за rate limiting
        """
        return await self.rate_limit_crud.check_rate_limit(
            db,
            limit_key=f"sms:{phone}",
            limit_type="sms_hourly",
            max_requests=self.SMS_RATE_LIMIT_PER_HOUR,
            window_minutes=60
        )

    async def check_login_rate_limit(
        self, 
        db: AsyncSession, 
        request: Request,
        phone: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Проверяет лимит попыток входа
        """
        ip_address = self.get_client_ip(request)
        limit_key = f"login:{phone}:{ip_address}" if phone else f"login:{ip_address}"
        
        return await self.rate_limit_crud.check_rate_limit(
            db,
            limit_key=limit_key,
            limit_type="login_hourly",
            max_requests=10,  # 10 попыток в час
            window_minutes=60
        )

    async def check_api_rate_limit(
        self, 
        db: AsyncSession, 
        request: Request
    ) -> Dict[str, Any]:
        """
        Проверяет общий лимит API запросов
        """
        ip_address = self.get_client_ip(request)
        
        return await self.rate_limit_crud.check_rate_limit(
            db,
            limit_key=f"api:{ip_address}",
            limit_type="api_minute",
            max_requests=self.API_RATE_LIMIT_PER_MINUTE,
            window_minutes=1
        )

    # ========== SESSION MANAGEMENT ==========
    
    async def create_secure_session(
        self,
        db: AsyncSession,
        user: User,
        request: Request,
        refresh_token: str
    ) -> DeviceSession:
        """
        Создает безопасную сессию с привязкой к устройству
        
        SOLID: комбинирует разные сервисы для создания сессии
        """
        # Генерируем fingerprint устройства (используем loose уровень для стабильности в мобильных браузерах)
        device_fingerprints = self.generate_flexible_fingerprint(request)
        device_fingerprint = device_fingerprints["loose"]
        
        # Получаем информацию об устройстве
        user_agent = request.headers.get("user-agent")
        device_info = self.parse_device_info(user_agent)
        
        # Получаем IP и геолокацию
        ip_address = self.get_client_ip(request)
        location_info = self.get_location_info(ip_address)
        
        # Проверяем лимит сессий для пользователя
        active_sessions = await self.device_session_crud.get_active_sessions_for_user(
            db, user.id
        )
        
        if len(active_sessions) >= self.MAX_SESSIONS_PER_USER:
            # Отзываем самую старую сессию
            oldest_session = active_sessions[-1]
            await self.device_session_crud.revoke_session(db, oldest_session.id)
            logger.info(f"Отозвана старая сессия {oldest_session.id} для пользователя {user.id}")
        
        # Создаем новую сессию
        session = await self.device_session_crud.create_session(
            db,
            user_id=user.id,
            device_fingerprint=device_fingerprint,
            refresh_token=refresh_token,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_hours=self.SESSION_LIFETIME_HOURS
        )
        
        # Обновляем дополнительную информацию
        session.browser_name = device_info["browser"]
        session.os_name = device_info["os"]
        session.device_type = device_info["device_type"]
        session.country = location_info["country"]
        session.city = location_info["city"]
        
        await db.commit()
        
        # Обновляем информацию о последнем входе в профиле пользователя
        await self.update_user_login_info(db, user, request)
        
        logger.info(
            f"Создана сессия {session.id} для пользователя {user.id} "
            f"с устройства {device_info['device_type']} ({device_info['browser']}) "
            f"из {location_info['city']}, {location_info['country']}"
        )
        
        return session

    async def validate_session(
        self,
        db: AsyncSession,
        refresh_token: str,
        request: Request,
        strict_fingerprint: bool = True
    ) -> Tuple[Optional[DeviceSession], Optional[User]]:
        """
        Валидирует сессию и проверяет безопасность с ОБЯЗАТЕЛЬНОЙ проверкой fingerprint
        
        SOLID: отдельная ответственность за валидацию
        """
        # Получаем сессию по токену
        session = await self.device_session_crud.get_session_by_refresh_token(
            db, refresh_token
        )
        
        if not session:
            logger.warning("Session not found by refresh token")
            return None, None
        
        # Получаем пользователя
        user = await self.user_crud.get_user(db, session.user_id)
        if not user or not user.is_active:
            logger.warning(f"User {session.user_id} not found or inactive")
            await self.device_session_crud.revoke_session(db, session.id)
            return None, None
        
        # 🛡️ ОБЯЗАТЕЛЬНАЯ ПРОВЕРКА DEVICE FINGERPRINT
        fingerprint_validation = await self.validate_device_fingerprint(
            db, session, request, strict_mode=strict_fingerprint
        )
        
        logger.info(f"Fingerprint validation: {fingerprint_validation}")
        
        # Обрабатываем результат проверки fingerprint
        if fingerprint_validation["action"] == "block":
            logger.error(
                f"🚫 SECURITY ALERT: Device fingerprint mismatch for session {session.id}. "
                f"Risk level: {fingerprint_validation['risk_level']}. "
                f"Details: {fingerprint_validation['details']}"
            )
            
            # Логируем подозрительную активность
            await self.log_security_event(
                db,
                event_type="fingerprint_mismatch",
                severity="high",
                user_id=user.id,
                ip_address=self.get_client_ip(request),
                user_agent=request.headers.get("user-agent"),
                description=f"Device fingerprint mismatch: {fingerprint_validation['details']['reason']}",
                additional_data=fingerprint_validation
            )
            
            # Отзываем сессию при критическом несоответствии
            await self.device_session_crud.revoke_session(db, session.id)
            return None, None
            
        elif fingerprint_validation["action"] == "warn":
            logger.warning(
                f"⚠️ Device fingerprint warning for session {session.id}. "
                f"Risk level: {fingerprint_validation['risk_level']}. "
                f"Reason: {fingerprint_validation['details'].get('reason', 'Unknown')}"
            )
            
            # Логируем предупреждение
            await self.log_security_event(
                db,
                event_type="fingerprint_warning",
                severity="medium",
                user_id=user.id,
                ip_address=self.get_client_ip(request),
                user_agent=request.headers.get("user-agent"),
                description=f"Device fingerprint warning: {fingerprint_validation['details'].get('reason', 'Unknown')}",
                additional_data=fingerprint_validation
            )
        
        # Обновляем время последнего использования
        current_ip = self.get_client_ip(request)
        await self.device_session_crud.update_last_used(db, session.id, current_ip)
        
        return session, user

    async def revoke_session(
        self,
        db: AsyncSession,
        refresh_token: str
    ) -> bool:
        """
        Отзывает сессию (logout)
        
        KISS: простая логика отзыва
        """
        session = await self.device_session_crud.get_session_by_refresh_token(
            db, refresh_token
        )
        
        if session:
            await self.device_session_crud.revoke_session(db, session.id)
            logger.info(f"Сессия {session.id} отозвана")
            return True
        
        return False

    async def revoke_all_sessions(
        self,
        db: AsyncSession,
        user_id: int,
        except_current: Optional[str] = None
    ) -> int:
        """
        Отзывает все сессии пользователя (выход со всех устройств)
        """
        except_session_id = None
        if except_current:
            current_session = await self.device_session_crud.get_session_by_refresh_token(
                db, except_current
            )
            if current_session:
                except_session_id = current_session.id
        
        revoked_count = await self.device_session_crud.revoke_all_sessions_for_user(
            db, user_id, except_session_id
        )
        
        logger.info(f"Отозвано {revoked_count} сессий для пользователя {user_id}")
        return revoked_count

    # ========== SECURITY LOGGING ==========
    
    async def log_security_event(
        self,
        db: AsyncSession,
        event_type: str,
        severity: str,
        user_id: Optional[int],
        ip_address: str,
        user_agent: Optional[str],
        description: str,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Логирует события безопасности
        """
        # Пока просто логируем в файл
        # TODO: Добавить сохранение в БД для аудита
        logger.info(
            f"SECURITY EVENT [{severity.upper()}]: {event_type} | "
            f"User: {user_id} | IP: {ip_address} | "
            f"Description: {description}"
        )
        
        if additional_data:
            logger.debug(f"Additional data: {additional_data}")

    # ========== USER MANAGEMENT ==========
    
    async def update_user_login_info(
        self,
        db: AsyncSession,
        user: User,
        request: Request
    ) -> None:
        """
        Обновляет информацию о последнем входе пользователя
        
        SOLID: отдельная ответственность за обновление логин-информации
        """
        user.last_login_at = datetime.utcnow()
        user.last_login_ip = self.get_client_ip(request)
        user.last_login_user_agent = request.headers.get("user-agent")
        user.failed_login_attempts = 0  # Сбрасываем счетчик неудачных попыток
        
        await db.commit()
        
        logger.info(f"Обновлена информация о входе для пользователя {user.id}")

    async def record_failed_login(
        self,
        db: AsyncSession,
        user: User
    ) -> None:
        """
        Записывает неудачную попытку входа
        
        SOLID: отдельная ответственность за обработку неудачных входов
        """
        user.failed_login_attempts += 1
        await db.commit()
        
        logger.warning(
            f"Неудачная попытка входа для пользователя {user.id}. "
            f"Всего неудачных попыток: {user.failed_login_attempts}"
        )
        
        # Логируем подозрительную активность если много попыток
        if user.failed_login_attempts >= self.MAX_FAILED_LOGINS:
            await self.log_security_event(
                db,
                event_type="repeated_failed_login",
                severity="high",
                user_id=user.id,
                ip_address="unknown",  # IP будет передан отдельно в вызывающем коде
                user_agent=None,
                description=f"Превышен лимит неудачных попыток входа: {user.failed_login_attempts}"
            )

    async def analyze_login_risk(
        self,
        db: AsyncSession,
        user: User,
        request: Request
    ) -> Dict[str, Any]:
        """
        Анализирует риски при входе в систему
        
        SOLID: отдельная ответственность за анализ рисков
        """
        risk_factors = []
        risk_score = 0
        
        # Проверяем количество неудачных попыток
        if user.failed_login_attempts >= 3:
            risk_factors.append("multiple_failed_attempts")
            risk_score += 30
        
        # Проверяем IP адрес
        current_ip = self.get_client_ip(request)
        if user.last_login_ip and user.last_login_ip != current_ip:
            risk_factors.append("different_ip")
            risk_score += 20
        
        # Проверяем User-Agent
        current_ua = request.headers.get("user-agent", "")
        if user.last_login_user_agent and user.last_login_user_agent != current_ua:
            risk_factors.append("different_user_agent")
            risk_score += 15
        
        # Проверяем время последнего входа
        if user.last_login_at:
            time_diff = datetime.utcnow() - user.last_login_at
            if time_diff.total_seconds() > 30 * 24 * 3600:  # Более 30 дней
                risk_factors.append("long_absence")
                risk_score += 10
        
        # Определяем уровень риска
        if risk_score >= 50:
            risk_level = "high"
        elif risk_score >= 25:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        return {
            "risk_level": risk_level,
            "risk_score": risk_score,
            "risk_factors": risk_factors,
            "requires_additional_verification": risk_score >= 40
        }

    # ========== UTILITY METHODS ==========
    
    def get_client_ip(self, request: Request) -> str:
        """
        Получает реальный IP адрес клиента с учетом прокси
        
        SOLID: вспомогательная функция с единственной ответственностью
        """
        # Проверяем заголовки прокси (в порядке приоритета)
        forwarded_ips = request.headers.get("x-forwarded-for")
        if forwarded_ips:
            # Берем первый IP из списка (реальный клиент)
            return forwarded_ips.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
        
        # Fallback на IP из соединения
        if hasattr(request, "client") and request.client:
            return request.client.host
        
        return "unknown"

    def generate_secure_token(self, length: int = 32) -> str:
        """
        Генерирует криптографически стойкий токен
        
        KISS: простая генерация токена
        """
        return secrets.token_urlsafe(length)

    def get_refresh_token_from_cookie(self, request: Request) -> Optional[str]:
        """
        Извлекает refresh token из HttpOnly cookie
        """
        return request.cookies.get("refresh_token")

    async def cleanup_expired_data(self, db: AsyncSession) -> Dict[str, int]:
        """
        Очищает истекшие данные (сессии, rate limits и т.д.)
        
        SOLID: отдельная ответственность за очистку
        """
        # Очищаем истекшие сессии
        expired_sessions = await self.device_session_crud.cleanup_expired_sessions(db)
        
        # Очищаем истекшие rate limits
        expired_limits = await self.rate_limit_crud.cleanup_expired_entries(db)
        
        logger.info(f"Очищено {expired_sessions} сессий и {expired_limits} rate limit записей")
        
        return {
            "expired_sessions": expired_sessions,
            "expired_rate_limits": expired_limits
        }


# Создаем глобальный экземпляр сервиса
auth_security_service = AuthSecurityService() 