from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime

class CustomerBase(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    notes: Optional[str] = None

class CustomerCreate(CustomerBase):
    @validator('phone')
    def validate_phone(cls, v):
        # Простая валидация российского номера
        import re
        if not re.match(r'^(\+7|8|7)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$', v):
            raise ValueError('Неверный формат номера телефона')
        return v

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    notes: Optional[str] = None
    
    @validator('phone')
    def validate_phone(cls, v):
        if v is not None:
            import re
            if not re.match(r'^(\+7|8|7)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$', v):
                raise ValueError('Неверный формат номера телефона')
        return v

class CustomerInDBBase(CustomerBase):
    id: int
    business_owner_id: int
    total_bookings_count: int
    total_spent: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class Customer(CustomerInDBBase):
    """Схема для возврата клиента"""
    pass

class CustomerWithStats(Customer):
    """Клиент с дополнительной статистикой"""
    # Вычисляемые поля
    spent_rub: Optional[float] = None  # Потрачено в рублях
    last_booking_date: Optional[datetime] = None
    is_vip: Optional[bool] = None  # VIP статус (например, > 5 бронирований)
    
    class Config:
        from_attributes = True

class CustomerSearch(BaseModel):
    """Параметры поиска клиентов"""
    search: Optional[str] = None
    skip: int = 0
    limit: int = 100

class CustomerListResponse(BaseModel):
    """Ответ со списком клиентов"""
    customers: List[Customer]
    total: int
    skip: int
    limit: int 