from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from db.session import get_db_session
from crud.user import user_crud
from schemas.user import (
    User, UserCreate, UserUpdate, UserLogin, UserProfile
)
from core.dependencies import get_current_user

router = APIRouter()

@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Регистрация нового бизнесмена
    """
    # Проверяем, что пользователь с таким номером не существует
    existing_user = await user_crud.get_user_by_phone(db, user_data.phone)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким номером телефона уже существует"
        )
    
    # Проверяем email если он указан
    if user_data.email:
        existing_email = await user_crud.get_user_by_email(db, user_data.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )
    
    # Создаем пользователя
    return await user_crud.create_user(db, user_data)

@router.post("/login")
async def login_user(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Авторизация бизнесмена
    """
    user = await user_crud.authenticate_user(db, login_data.phone, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный номер телефона или пароль"
        )
    
    # TODO: Здесь нужно будет создать JWT токен
    return {
        "message": "Успешная авторизация",
        "user": User.from_orm(user)
    }

@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получить профиль текущего пользователя
    """
    # TODO: Добавить подсчет статистики (клиентов, бронирований)
    profile_data = UserProfile.from_orm(current_user)
    profile_data.total_customers = 0  # Заглушка
    profile_data.total_bookings = 0   # Заглушка
    
    return profile_data

@router.put("/me", response_model=User)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Обновить профиль текущего пользователя
    """
    updated_user = await user_crud.update_user(db, current_user.id, user_update)
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    return updated_user

@router.get("/", response_model=List[User])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """
    Получить список пользователей (только для админов)
    """
    # TODO: Добавить проверку прав администратора
    users = await user_crud.get_users(
        db, 
        skip=skip, 
        limit=limit, 
        search=search, 
        is_active=is_active
    )
    return users

@router.get("/{user_id}", response_model=User)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """
    Получить пользователя по ID
    """
    # Пользователь может видеть только свой профиль
    if current_user.id != user_id:
        # TODO: Добавить проверку прав администратора
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав"
        )
    
    user = await user_crud.get_user(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    return user

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Удалить (деактивировать) текущего пользователя
    """
    success = await user_crud.delete_user(db, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        ) 