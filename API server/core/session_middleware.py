from fastapi import HTTPException, status, Request, Header, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from services.auth_security_service import AuthSecurityService
from crud.user import user_crud
from crud.device_session import CRUDDeviceSession
from db.session import get_db_session
import logging

logger = logging.getLogger(__name__)

class SessionSecurityMiddleware:
    """
    Middleware для автоматической проверки валидности device session
    на всех защищенных API endpoints
    """
    
    def __init__(self):
        self.security_service = AuthSecurityService()
        self.device_session_crud = CRUDDeviceSession()
    
    async def verify_session_security(
        self,
        request: Request,
        authorization: str,
        db: AsyncSession
    ) -> dict:
        """
        Проверяет валидность access token и device session
        
        Returns:
            dict: {"user_id": int, "session_id": int} если валидно
        
        Raises:
            HTTPException: 401 если сессия недействительна
        """
        
        # 1. Проверяем формат authorization header
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Отсутствует или неверный токен авторизации"
            )
        
        # 2. Извлекаем и проверяем access token
        token = authorization.replace("Bearer ", "")
        
        # Проверка формата токена (поддерживаем как старые токены, так и JWT)
        is_legacy_token = (token.startswith("google_token_") or 
                          token.startswith("telegram_token_") or 
                          token.startswith("sms_token_") or
                          token.startswith("vk_token_"))
        is_jwt_token = token.startswith("eyJ")  # JWT токены начинаются с eyJ
        
        if not (is_legacy_token or is_jwt_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный формат токена"
            )
        
        # 3. Извлекаем user_id из токена
        try:
            if is_jwt_token:
                # Для JWT токенов декодируем payload
                import jwt
                from core.config import settings
                
                try:
                    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
                    user_id = int(payload.get("sub"))
                    if not user_id:
                        raise ValueError("Отсутствует subject в JWT токене")
                except jwt.ExpiredSignatureError:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Токен истек"
                    )
                except jwt.InvalidTokenError:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Неверный JWT токен"
                    )
            else:
                # Для старых токенов извлекаем из имени
                parts = token.split("_")
                if len(parts) >= 3:
                    user_id = int(parts[2])
                else:
                    raise ValueError("Неверный формат токена")
        except (ValueError, IndexError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный формат токена"
            )
        
        # 4. Проверяем что пользователь существует
        user = await user_crud.get_user(db, user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден или заблокирован"
            )
        
        # 5. 🛡️ ОБЯЗАТЕЛЬНАЯ ПРОВЕРКА DEVICE SESSION
        refresh_token_from_cookie = self.security_service.get_refresh_token_from_cookie(request)
        
        if not refresh_token_from_cookie:
            logger.warning(f"Refresh token отсутствует в cookie для user_id: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Сессия недействительна - отсутствует refresh token"
            )
        
        # 🛡️ ВАЛИДИРУЕМ СЕССИЮ С ПРОВЕРКОЙ DEVICE FINGERPRINT
        session, validated_user = await self.security_service.validate_session(
            db, refresh_token_from_cookie, request, strict_fingerprint=False  # 🔧 Отключаем strict mode для dev
        )
        
        if not session or not validated_user:
            logger.warning(f"Session validation failed for user_id: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Сессия завершена или недействительна"
            )
        
        if session.user_id != user.id:
            logger.warning(f"Session user mismatch: {session.user_id} != {user.id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Сессия недействительна"
            )
        
        logger.debug(f"Session validated with fingerprint check: ID={session.id}, user_id={user_id}")
        
        return {
            "user_id": user_id,
            "session_id": session.id,
            "user": validated_user,
            "db": db
        }

# Создаем глобальный экземпляр
session_middleware = SessionSecurityMiddleware()


async def require_valid_session(
    request: Request,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """
    Dependency для проверки валидной сессии на защищенных endpoints
    
    Usage:
        @router.get("/protected-endpoint")
        async def protected_endpoint(
            session_data: dict = Depends(require_valid_session)
        ):
            user_id = session_data["user_id"]
            # ... остальная логика
    """
    return await session_middleware.verify_session_security(request, authorization, db) 
