from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class ClientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Имя клиента")
    phone: str = Field(..., min_length=10, max_length=32, description="Номер телефона")
    email: Optional[str] = Field(None, max_length=255, description="Email адрес")
    avatar: Optional[str] = Field(None, max_length=500, description="URL аватара пользователя")
    is_vip: bool = Field(False, description="VIP статус клиента")
    comments: Optional[str] = Field(None, description="Комментарии о клиенте")


class ClientCreate(ClientBase):
    password_hash: Optional[str] = Field(None, description="Хеш пароля для аутентификации")


class ClientUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, min_length=10, max_length=32)
    email: Optional[str] = Field(None, max_length=255)
    avatar: Optional[str] = Field(None, max_length=500)
    is_vip: Optional[bool] = None
    comments: Optional[str] = None


class ClientResponse(ClientBase):
    id: int
    total_bookings: int = Field(0, description="Общее количество бронирований (с fallback)")
    completed_bookings: int = Field(0, description="Количество завершенных бронирований (с fallback)")
    created_at: datetime
    updated_at: datetime
    
    # Резервные счетчики (для мониторинга и защиты от потери данных)
    total_bookings_count: int = Field(0, description="Резервный счетчик общих бронирований")
    completed_bookings_count: int = Field(0, description="Резервный счетчик завершенных бронирований")
    cancelled_bookings_count: int = Field(0, description="Резервный счетчик отмененных бронирований")
    total_revenue: Decimal = Field(Decimal('0.00'), description="Общий доход от клиента")
    first_booking_date: Optional[datetime] = Field(None, description="Дата первого бронирования")
    last_booking_date: Optional[datetime] = Field(None, description="Дата последнего бронирования")

    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm(cls, obj):
        from loguru import logger
        
        # Используем методы модели для безопасного доступа к бронированиям
        logger.info(f"[CLIENT_FROM_ORM] Обработка клиента {obj.name} (ID: {obj.id})")
        logger.info(f"[CLIENT_FROM_ORM] _bookings_loaded: {hasattr(obj, '_bookings_loaded') and obj._bookings_loaded}")
        
        # 🔧 Всегда используем резервные счетчики из базы данных (по требованию пользователя)
        total_bookings = obj.total_bookings_count
        completed_bookings = obj.completed_bookings_count
        logger.info(f"[CLIENT_FROM_ORM] Получили данные: total={total_bookings}, completed={completed_bookings}")
            
        response = cls(
            id=obj.id,
            name=obj.name,
            phone=obj.phone,
            email=obj.email,
            avatar=obj.avatar,
            is_vip=obj.is_vip,
            comments=obj.comments,
            total_bookings=total_bookings,
            completed_bookings=completed_bookings,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
            
            # Резервные счетчики
            total_bookings_count=obj.total_bookings_count,
            completed_bookings_count=obj.completed_bookings_count,
            cancelled_bookings_count=obj.cancelled_bookings_count,
            total_revenue=obj.total_revenue,
            first_booking_date=obj.first_booking_date,
            last_booking_date=obj.last_booking_date,
        )
        
        logger.info(f"[CLIENT_FROM_ORM] Итоговый ответ для {obj.name}: total_bookings={response.total_bookings}, completed_bookings={response.completed_bookings}, is_vip={response.is_vip}")
        return response


class ClientSearchResponse(BaseModel):
    """Упрощенная схема для поиска клиентов (автокомплит)"""
    id: str
    name: str
    phone: str
    is_vip: bool = False
    total_bookings: int = 0
    last_booking_date: Optional[str] = None
    comments: Optional[str] = None 