from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import os
import uuid
from pathlib import Path
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

@router.post("/{user_id}/avatar")
async def upload_user_avatar(
    user_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Загрузить аватар для пользователя
    """
    # Пользователь может загружать аватар только для себя
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав"
        )
    
    # Проверяем тип файла
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл должен быть изображением"
        )
    
    # Проверяем размер файла (максимум 5MB)
    if file.size and file.size > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Размер файла не должен превышать 5MB"
        )
    
    try:
        # Создаем директорию для аватаров если её нет
        avatars_dir = Path("data/avatars")
        avatars_dir.mkdir(parents=True, exist_ok=True)
        
        # Генерируем уникальное имя файла
        file_extension = file.filename.split('.')[-1] if file.filename and '.' in file.filename else 'jpg'
        unique_filename = f"user_{user_id}_{uuid.uuid4().hex}.{file_extension}"
        file_path = avatars_dir / unique_filename
        
        # Сохраняем файл
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Обновляем путь к аватару в базе данных
        avatar_url = f"/static/avatars/{unique_filename}"
        user_update = UserUpdate(avatar=avatar_url)
        updated_user = await user_crud.update_user(db, user_id, user_update)
        
        if not updated_user:
            # Удаляем файл если не удалось обновить БД
            if file_path.exists():
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Ошибка при сохранении аватара"
            )
        
        return {
            "message": "Аватар успешно загружен",
            "avatar_url": avatar_url,
            "user": updated_user
        }
        
    except Exception as e:
        # Удаляем файл если произошла ошибка
        if 'file_path' in locals() and file_path.exists():
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при загрузке аватара: {str(e)}"
        )

@router.delete("/{user_id}/avatar")
async def delete_user_avatar(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Удалить аватар пользователя
    """
    # Пользователь может удалять аватар только у себя
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав"
        )
    
    try:
        # Получаем текущего пользователя
        user = await user_crud.get_user(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        # Удаляем файл аватара если он есть
        if user.avatar:
            # Извлекаем имя файла из URL
            if user.avatar.startswith('/static/avatars/'):
                filename = user.avatar.replace('/static/avatars/', '')
                file_path = Path("data/avatars") / filename
                if file_path.exists():
                    os.remove(file_path)
        
        # Обновляем запись в БД
        user_update = UserUpdate(avatar=None)
        updated_user = await user_crud.update_user(db, user_id, user_update)
        
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Ошибка при удалении аватара"
            )
        
        return {
            "message": "Аватар успешно удален",
            "user": updated_user
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при удалении аватара: {str(e)}"
        ) 