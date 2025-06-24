from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, Mapped
from typing import Optional, TYPE_CHECKING, Dict, Any
from .base import Base

if TYPE_CHECKING:
    from .user import User
    from .customer import Customer

class Booking(Base):
    __tablename__ = 'bookings'

    id = Column(Integer, primary_key=True, index=True)
    
    # Новые связи
    business_owner_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey('customers.id'), nullable=False, index=True)
    
    # Старые поля для обратной совместимости (можно будет удалить позже)
    client_name = Column(String(128), nullable=True)  # Теперь nullable
    phone = Column(String(32), nullable=True)  # Теперь nullable
    
    # Основные поля бронирования
    planned_start_time = Column(DateTime(timezone=True), nullable=False)
    service_type = Column(String(32), nullable=False)
    
    # Старая система инвентаря (для совместимости)
    board_count = Column(Integer, nullable=False, default=0)
    board_with_seat_count = Column(Integer, nullable=False, default=0)
    raft_count = Column(Integer, nullable=False, default=0)
    
    # Новая система инвентаря: JSON поле для хранения {type_id: quantity}
    selected_items: Mapped[Optional[Dict[str, Any]]] = Column(JSON, nullable=True)
    
    duration_in_hours = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default='booked')
    actual_start_time = Column(DateTime(timezone=True), nullable=True)
    time_returned_by_client = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Новые связи
    business_owner: Mapped["User"] = relationship("User", back_populates="bookings")
    customer: Mapped["Customer"] = relationship("Customer", back_populates="bookings")
    
    # Старая связь для совместимости (удалена, так как модель Client больше не существует)
    # client: Mapped[Optional["Client"]] = relationship("Client", back_populates="bookings", foreign_keys=[client_id])