from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, Mapped
from typing import List, Optional, TYPE_CHECKING
from .base import Base

if TYPE_CHECKING:
    from .user import User
    from .booking import Booking

class Customer(Base):
    """
    Модель для клиентов бизнесменов (те, кто арендует SUP доски)
    """
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    phone = Column(String(32), nullable=False, index=True)
    email = Column(String(255), nullable=True)
    
    # Связь с бизнесменом
    business_owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Статистика клиента
    total_bookings_count = Column(Integer, default=0, nullable=False)
    total_spent = Column(Integer, default=0, nullable=False)  # В копейках
    
    # Дополнительная информация
    notes = Column(Text, nullable=True)  # Заметки бизнесмена о клиенте
    
    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Связи
    business_owner: Mapped["User"] = relationship("User", back_populates="customers")
    bookings: Mapped[List["Booking"]] = relationship("Booking", back_populates="customer")
    
    def __repr__(self):
        return f"<Customer(id={self.id}, name='{self.name}', phone='{self.phone}')>" 