from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# Схемы для типов инвентаря
class InventoryTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    display_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    icon_name: Optional[str] = None
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    is_active: bool = True
    affects_availability: bool = True  # Влияет ли на занятость временных слотов
    board_equivalent: float = 1.0      # Сколько "досок" эквивалентно одной единице
    settings: Optional[Dict[str, Any]] = None

class InventoryTypeCreate(InventoryTypeBase):
    pass

class InventoryTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    icon_name: Optional[str] = None
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    is_active: Optional[bool] = None
    affects_availability: Optional[bool] = None
    board_equivalent: Optional[float] = None
    settings: Optional[Dict[str, Any]] = None

class InventoryTypeOut(InventoryTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    items_count: Optional[int] = 0  # Количество единиц данного типа
    available_count: Optional[int] = 0  # Количество доступных единиц

    class Config:
        from_attributes = True

# Схемы для единиц инвентаря
class InventoryItemBase(BaseModel):
    inventory_type_id: int
    name: Optional[str] = None
    status: str = "available"
    current_booking_id: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[datetime] = None
    condition: str = "good"  # Состояние: good, fair, poor
    is_active: bool = True   # Активен ли элемент
    notes: Optional[str] = None
    item_metadata: Optional[Dict[str, Any]] = None

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    current_booking_id: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[datetime] = None
    condition: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    item_metadata: Optional[Dict[str, Any]] = None

class InventoryItemOut(InventoryItemBase):
    id: int
    created_at: datetime
    updated_at: datetime
    last_service_end: Optional[datetime] = None
    inventory_type: Optional[InventoryTypeOut] = None

    class Config:
        from_attributes = True

# Схема для полной информации о типе инвентаря с единицами
class InventoryTypeWithItems(InventoryTypeOut):
    items: List[InventoryItemOut] = []

# Схема для статистики инвентаря
class InventoryTypeStats(BaseModel):
    display_name: str
    total: int
    available: int
    in_use: int
    servicing: int
    repair: int

class InventoryStats(BaseModel):
    total_types: int
    total_items: int
    available_items: int
    in_use_items: int
    servicing_items: int
    repair_items: int
    by_type: Dict[str, Dict[str, Any]]  # Статистика по типам

# Схема для быстрого создания типа с единицами
class InventoryTypeQuickCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    icon_name: Optional[str] = None
    color: Optional[str] = None
    affects_availability: bool = False  # По умолчанию НЕ влияет на доступность (аксессуары)
    board_equivalent: float = 0.0       # По умолчанию не эквивалентно доскам
    initial_quantity: int = Field(1, ge=1, le=100)  # Количество единиц для создания
    settings: Optional[Dict[str, Any]] = None 