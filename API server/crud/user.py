from typing import Optional, List, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlalchemy import and_, or_, select
from models.user import User
from schemas.user import UserCreate, UserCreateOAuth, UserUpdate
from passlib.context import CryptContext
from datetime import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class CRUDUser:
    async def get_user(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """Получить пользователя по ID"""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    
    async def get_user_by_phone(self, db: AsyncSession, phone: str) -> Optional[User]:
        """Получить пользователя по номеру телефона"""
        result = await db.execute(select(User).where(User.phone == phone))
        return result.scalar_one_or_none()
    
    async def get_user_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Получить пользователя по email"""
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()
    
    async def get_users(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100,
        search: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[User]:
        """Получить список пользователей с фильтрацией"""
        query = select(User)
        
        if search:
            query = query.where(
                or_(
                    User.name.ilike(f"%{search}%"),
                    User.phone.ilike(f"%{search}%"),
                    User.business_name.ilike(f"%{search}%")
                )
            )
        
        if is_active is not None:
            query = query.where(User.is_active == is_active)
        
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()
    
    async def create_user(self, db: AsyncSession, user_in: Union[UserCreate, UserCreateOAuth]) -> User:
        """Создать нового пользователя"""
        # Проверяем тип входных данных и обрабатываем пароль соответственно
        if isinstance(user_in, UserCreateOAuth):
            # OAuth пользователь - пароль не обязателен
            hashed_password = pwd_context.hash("oauth_no_password") if not user_in.password else pwd_context.hash(user_in.password)
        else:
            # Обычный пользователь - пароль обязателен
            hashed_password = pwd_context.hash(user_in.password)
        
        db_user = User(
            name=user_in.name,
            phone=user_in.phone,
            email=user_in.email,
            password_hash=hashed_password,
            avatar=getattr(user_in, 'avatar', None),
            business_name=getattr(user_in, 'business_name', None),
            business_description=getattr(user_in, 'business_description', None),
            business_address=getattr(user_in, 'business_address', None),
            business_phone=getattr(user_in, 'business_phone', None),
            is_active=True
        )
        
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)
        return db_user
    
    async def update_user(self, db: AsyncSession, user_id: int, user_update: UserUpdate) -> Optional[User]:
        """Обновить пользователя"""
        db_user = await self.get_user(db, user_id)
        if not db_user:
            return None
        
        update_data = user_update.dict(exclude_unset=True)
        
        # Хешируем новый пароль если он предоставлен
        if "password" in update_data:
            update_data["password_hash"] = pwd_context.hash(update_data.pop("password"))
        
        for field, value in update_data.items():
            setattr(db_user, field, value)
        
        await db.commit()
        await db.refresh(db_user)
        return db_user
    
    async def delete_user(self, db: AsyncSession, user_id: int) -> bool:
        """Удалить пользователя (мягкое удаление)"""
        db_user = await self.get_user(db, user_id)
        if not db_user:
            return False
        
        db_user.is_active = False
        await db.commit()
        return True
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Проверить пароль"""
        return pwd_context.verify(plain_password, hashed_password)
    
    async def authenticate_user(self, db: AsyncSession, phone: str, password: str) -> Optional[User]:
        """Аутентификация пользователя"""
        user = await self.get_user_by_phone(db, phone)
        if not user or not user.is_active:
            return None
        
        if not self.verify_password(password, user.password_hash):
            return None
        
        return user
    
    async def update_login_info(
        self, 
        db: AsyncSession, 
        user_id: int, 
        ip_address: str, 
        user_agent: str,
        device_fingerprint: Optional[str] = None
    ) -> Optional[User]:
        """Обновить информацию о входе"""
        db_user = await self.get_user(db, user_id)
        if not db_user:
            return None
        
        db_user.last_login_at = datetime.utcnow()
        db_user.last_login_ip = ip_address
        db_user.last_login_user_agent = user_agent
        
        if device_fingerprint:
            db_user.device_fingerprint = device_fingerprint
        
        # Сбрасываем счетчик неудачных попыток
        db_user.failed_login_attempts = 0
        
        await db.commit()
        await db.refresh(db_user)
        return db_user
    
    async def increment_failed_attempts(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """Увеличить счетчик неудачных попыток входа"""
        db_user = await self.get_user(db, user_id)
        if not db_user:
            return None
        
        db_user.failed_login_attempts += 1
        await db.commit()
        await db.refresh(db_user)
        return db_user
    
    async def update_password(self, db: AsyncSession, user_id: int, new_password: str) -> bool:
        """Обновить пароль пользователя"""
        try:
            db_user = await self.get_user(db, user_id)
            if not db_user:
                return False
            
            # Хешируем новый пароль
            hashed_password = pwd_context.hash(new_password)
            db_user.password_hash = hashed_password
            
            # Обновляем время изменения пароля
            db_user.updated_at = datetime.utcnow()
            
            await db.commit()
            await db.refresh(db_user)
            return True
            
        except Exception:
            await db.rollback()
            return False

# Создаем глобальный экземпляр
user_crud = CRUDUser() 