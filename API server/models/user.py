from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, Mapped
from typing import List, Optional, TYPE_CHECKING
from datetime import datetime
from .base import Base

if TYPE_CHECKING:
    from .customer import Customer
    from .booking import Booking

class User(Base):
    """
    Модель для зарегистрированных бизнесменов (владельцев прокатов SUP досок)
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    phone = Column(String(32), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=False)  # Обязательно для бизнесменов
    avatar = Column(String(500), nullable=True)
    
    # Бизнес информация
    business_name = Column(String(255), nullable=True)  # Название бизнеса
    business_description = Column(Text, nullable=True)  # Описание услуг
    business_address = Column(String(500), nullable=True)  # Адрес проката
    business_phone = Column(String(32), nullable=True)  # Рабочий телефон
    
    # Поля безопасности и авторизации
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String(45), nullable=True)
    last_login_user_agent = Column(Text, nullable=True)
    device_fingerprint = Column(String(255), nullable=True)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    sms_requests_count = Column(Integer, default=0, nullable=False)
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Связи
    customers: Mapped[List["Customer"]] = relationship("Customer", back_populates="business_owner")
    bookings: Mapped[List["Booking"]] = relationship("Booking", back_populates="business_owner")
    
    def __repr__(self):
        return f"<User(id={self.id}, name='{self.name}', business='{self.business_name}')>" 