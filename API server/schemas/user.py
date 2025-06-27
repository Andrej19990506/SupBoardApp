from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    avatar: Optional[str] = None
    business_name: Optional[str] = None
    business_description: Optional[str] = None
    business_address: Optional[str] = None
    business_phone: Optional[str] = None

class UserCreate(UserBase):
    password: str
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Пароль должен содержать минимум 6 символов')
        return v
    
    @validator('phone')
    def validate_phone(cls, v):
        # Простая валидация российского номера
        import re
        if not re.match(r'^(\+7|8|7)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$', v):
            raise ValueError('Неверный формат номера телефона')
        return v

class UserCreateOAuth(UserBase):
    """Схема для создания пользователей через OAuth (без пароля)"""
    password: Optional[str] = None  # Пароль не обязателен для OAuth
    
    @validator('phone')
    def validate_phone_oauth(cls, v):
        # Более гибкая валидация для OAuth пользователей
        import re
        # Обычный российский номер или временные OAuth номера (+g..., +v..., +t...)
        if not (re.match(r'^(\+7|8|7)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$', v) or
                re.match(r'^\+[gvt]\d{10}$', v)):  # OAuth временные номера
            raise ValueError('Неверный формат номера телефона')
        return v

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar: Optional[str] = None
    password: Optional[str] = None
    business_name: Optional[str] = None
    business_description: Optional[str] = None
    business_address: Optional[str] = None
    business_phone: Optional[str] = None
    is_active: Optional[bool] = None
    
    @validator('password')
    def validate_password(cls, v):
        if v is not None and len(v) < 6:
            raise ValueError('Пароль должен содержать минимум 6 символов')
        return v

class UserInDBBase(UserBase):
    id: int
    is_active: bool
    last_login_at: Optional[datetime] = None
    failed_login_attempts: int
    sms_requests_count: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class User(UserInDBBase):
    """Схема для возврата пользователя (без конфиденциальных данных)"""
    pass

class UserInDB(UserInDBBase):
    """Схема для внутреннего использования (с конфиденциальными данными)"""
    password_hash: str
    last_login_ip: Optional[str] = None
    last_login_user_agent: Optional[str] = None
    device_fingerprint: Optional[str] = None

class UserLogin(BaseModel):
    phone: str
    password: str

class UserProfile(BaseModel):
    """Расширенная информация о профиле пользователя"""
    id: int
    name: str
    phone: str
    email: Optional[str] = None
    business_name: Optional[str] = None
    business_description: Optional[str] = None
    business_address: Optional[str] = None
    business_phone: Optional[str] = None
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    
    # Статистика
    total_customers: Optional[int] = 0
    total_bookings: Optional[int] = 0
    
    class Config:
        from_attributes = True 