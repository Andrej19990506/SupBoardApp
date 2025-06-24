import redis.asyncio as redis
from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db_session
from models.user import User
from crud.user import user_crud
from core.config import settings
import jwt

# Глобальная переменная для хранения клиента (импортируется из main или передается)
# Лучше использовать Request State или DI контейнер в будущем
# Пока что предполагаем, что redis_client импортируется или доступен глобально
# TODO: Рефакторить способ доступа к redis_client

# Временное решение: импортируем напрямую из main, но это сохраняет риск
# Лучше передавать клиент через Request state или через DI.
# Эта версия все еще может вызвать проблемы при импорте, если main.py сам импортирует что-то отсюда
# через другие модули.
try:
    # Попытка импорта, чтобы получить доступ к глобальной переменной
    # ВНИМАНИЕ: Это не идеальное решение!
    from ..main import redis_client as global_redis_client
except ImportError:
    # Если импорт не удался (например, при тестировании или другом сценарии),
    # устанавливаем в None. Зависимость должна будет обработать это.
    global_redis_client = None

async def get_redis_client() -> Optional[redis.Redis]:
    # Возвращаем импортированный глобальный клиент
    return global_redis_client

async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db_session)
) -> User:
    """
    Получить текущего пользователя (User) по JWT токену
    """
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
    
    # Проверяем JWT токен
    if not token.startswith("eyJ"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный формат токена"
        )
    
    try:
        # Декодируем JWT токен
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        user_id = int(payload.get("sub"))
    except (jwt.InvalidTokenError, ValueError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный токен"
        )
    
    # Получаем пользователя из базы данных
    user = await user_crud.get_user(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден или неактивен"
        )
    
    return user 