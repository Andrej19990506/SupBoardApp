from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from db.session import get_db_session
from crud.user import user_crud
from services.auth_security_service import AuthSecurityService
from services.password_recovery_service import PasswordRecoveryService
from services.email_service import email_service
from datetime import datetime, timedelta
import logging

# Создаем router для password recovery endpoints
router = APIRouter()

# Настройка логирования
logger = logging.getLogger(__name__)

# Инициализация сервисов
security_service = AuthSecurityService()
password_recovery_service = PasswordRecoveryService()

# Pydantic модели для запросов
class ForgotPasswordRequest(BaseModel):
    phone: str

class ResetPasswordVerifyRequest(BaseModel):
    phone: str
    code: str

class ResetPasswordRequest(BaseModel):
    phone: str
    reset_token: str
    new_password: str

class EmailFallbackRequest(BaseModel):
    email: EmailStr
    phone: str

@router.post("/forgot-password")
async def forgot_password(
    request_data: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Отправляет SMS код для восстановления пароля
    """
    try:
        logger.info(f"🔐 Запрос восстановления пароля для: {request_data.phone}")
        
        # Проверяем существование пользователя
        user = await user_crud.get_user_by_phone(db, phone=request_data.phone)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь с таким номером телефона не найден"
            )
        
        # Проверяем rate limit для SMS
        rate_limit_result = await security_service.check_sms_rate_limit(db, request_data.phone)
        if not rate_limit_result["allowed"]:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Превышен лимит SMS запросов. Попробуйте через {rate_limit_result['reset_at']} минут."
            )
        
        # Отправляем SMS код через сервис
        result = await password_recovery_service.send_reset_code(
            db=db,
            phone=request_data.phone,
            user=user,
            request=request
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["error"]
            )
        
        logger.info(f"✅ SMS код восстановления отправлен для: {request_data.phone}")
        
        return {
            "success": True,
            "message": "SMS код для восстановления пароля отправлен",
            "expires_in": 300  # 5 минут
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка отправки кода восстановления: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )

@router.post("/verify-reset-code")
async def verify_reset_code(
    request_data: ResetPasswordVerifyRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Проверяет SMS код для восстановления пароля
    """
    try:
        logger.info(f"🔍 Проверка кода восстановления для: {request_data.phone}")
        
        # Проверяем код через сервис
        result = await password_recovery_service.verify_reset_code(
            db=db,
            phone=request_data.phone,
            code=request_data.code
        )
        
        if not result["valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        logger.info(f"✅ Код восстановления подтвержден для: {request_data.phone}")
        
        return {
            "success": True,
            "message": "Код подтвержден. Введите новый пароль.",
            "reset_token": result["reset_token"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка проверки кода восстановления: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )

@router.post("/reset-password")
async def reset_password(
    request_data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Устанавливает новый пароль после подтверждения SMS кода
    """
    try:
        logger.info(f"🔐 Сброс пароля для: {request_data.phone}")
        
        # Сбрасываем пароль через сервис
        result = await password_recovery_service.reset_password_with_token(
            db=db,
            phone=request_data.phone,
            reset_token=request_data.reset_token,
            new_password=request_data.new_password
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        logger.info(f"✅ Пароль успешно изменен для: {request_data.phone}")
        
        return {
            "success": True,
            "message": "Пароль успешно изменен. Войдите с новым паролем."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка сброса пароля: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )

@router.post("/email-fallback")
async def email_fallback_recovery(
    request_data: EmailFallbackRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Альтернативное восстановление через email + номер телефона при регистрации
    """
    try:
        logger.info(f"📧 Email восстановление для: {request_data.email} + {request_data.phone}")
        
        # Проверяем пользователя через сервис
        result = await password_recovery_service.email_fallback_recovery(
            db=db,
            email=request_data.email,
            phone=request_data.phone,
            request=request
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        logger.info(f"✅ Email восстановление инициировано для: {request_data.email}")
        
        return {
            "success": True,
            "message": result["message"],
            "method": result["method"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка email восстановления: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )

@router.get("/verify-email-token/{token}")
async def verify_email_reset_token(
    token: str,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Проверяет токен восстановления пароля из email
    """
    try:
        logger.info(f"🔍 Проверка email токена: {token[:16]}...")
        
        # Проверяем токен через email сервис
        result = email_service.verify_email_reset_token(token)
        
        if not result["valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        # Дополнительно проверяем что пользователь существует
        user = await user_crud.get_user_by_email(db, email=result["email"])
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        logger.info(f"✅ Email токен валидный для пользователя: {user.name}")
        
        return {
            "valid": True,
            "user_name": result["user_name"],
            "email": result["email"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка проверки email токена: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )

@router.post("/reset-password-email")
async def reset_password_with_email_token(
    request_data: dict,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Сбрасывает пароль используя токен из email
    """
    try:
        token = request_data.get("token")
        new_password = request_data.get("new_password")
        
        if not token or not new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Отсутствует токен или новый пароль"
            )
        
        if len(new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пароль должен содержать минимум 6 символов"
            )
        
        logger.info(f"🔐 Сброс пароля через email токен: {token[:16]}...")
        
        # Проверяем токен
        token_result = email_service.verify_email_reset_token(token)
        if not token_result["valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=token_result["error"]
            )
        
        # Находим пользователя
        user = await user_crud.get_user_by_email(db, email=token_result["email"])
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        # Обновляем пароль
        success = await user_crud.update_password(db, user.id, new_password)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось обновить пароль"
            )
        
        # Удаляем использованный токен
        email_service.consume_email_reset_token(token)
        
        # Отправляем уведомление о смене пароля
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
        
        logger.info(f"✅ Пароль успешно изменен через email для пользователя: {user.name}")
        
        return {
            "success": True,
            "message": "Пароль успешно изменен. Войдите с новым паролем."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка сброса пароля через email: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        ) 