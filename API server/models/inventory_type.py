from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, JSON, ForeignKey, DECIMAL
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class InventoryType(Base):
    __tablename__ = 'inventory_types'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # Название типа (например "Жилет", "Весло", "Каяк")
    display_name = Column(String(200), nullable=False)  # Отображаемое название
    description = Column(Text, nullable=True)  # Описание типа инвентаря
    icon_name = Column(String(50), nullable=True)  # Название иконки (emoji или имя файла)
    color = Column(String(7), nullable=True)  # Цвет для отображения (hex)
    is_active = Column(Boolean, nullable=False, default=True)  # Активен ли тип
    affects_availability = Column(Boolean, nullable=False, default=True)  # Влияет ли на занятость временных слотов
    board_equivalent = Column(DECIMAL(3,2), nullable=False, default=1.0)  # Сколько "досок" эквивалентно одной единице
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Настройки для типа инвентаря
    settings = Column(JSON, nullable=True)  # Дополнительные настройки в JSON
    
    # Связь с единицами инвентаря
    items = relationship("InventoryItem", back_populates="inventory_type", cascade="all, delete-orphan")

class InventoryItem(Base):
    __tablename__ = 'inventory_items'

    id = Column(Integer, primary_key=True, index=True)
    inventory_type_id = Column(Integer, ForeignKey('inventory_types.id'), nullable=False)
    name = Column(String(100), nullable=True)  # Кастомное название единицы (например "Жилет #1")
    status = Column(String(32), nullable=False, default='available', index=True)
    current_booking_id = Column(String, nullable=True)
    last_service_end = Column(DateTime(timezone=True), nullable=True)
    
    # Дополнительные поля для единицы инвентаря
    serial_number = Column(String(100), nullable=True)  # Серийный номер
    purchase_date = Column(DateTime(timezone=True), nullable=True)  # Дата покупки
    condition = Column(String(20), nullable=False, default='good', index=True)  # Состояние инвентаря
    is_active = Column(Boolean, nullable=False, default=True, index=True)  # Активен ли элемент
    notes = Column(Text, nullable=True)  # Заметки
    item_metadata = Column(JSON, nullable=True)  # Дополнительные данные в JSON
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Связи
    inventory_type = relationship("InventoryType", back_populates="items") 