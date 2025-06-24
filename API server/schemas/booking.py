from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class BookingBase(BaseModel):
    # Новые поля (опциональные для совместимости)
    business_owner_id: Optional[int] = None
    customer_id: Optional[int] = None
    
    # Старые поля для обратной совместимости
    client_name: Optional[str] = None
    phone: Optional[str] = None
    
    planned_start_time: datetime
    service_type: str
    board_count: int = 0
    board_with_seat_count: int = 0
    raft_count: int = 0
    # Новая система инвентаря: type_id -> quantity
    selected_items: Optional[Dict[str, Any]] = None
    duration_in_hours: int
    comment: Optional[str] = None
    status: str = "booked"
    actual_start_time: Optional[datetime] = None
    time_returned_by_client: Optional[datetime] = None

class BookingCreate(BookingBase):
    pass

class BookingUpdate(BaseModel):
    business_owner_id: Optional[int] = None
    customer_id: Optional[int] = None
    client_name: Optional[str] = None
    phone: Optional[str] = None
    planned_start_time: Optional[datetime] = None
    service_type: Optional[str] = None
    board_count: Optional[int] = None
    board_with_seat_count: Optional[int] = None
    raft_count: Optional[int] = None
    # Новая система инвентаря: type_id -> quantity
    selected_items: Optional[Dict[str, Any]] = None
    duration_in_hours: Optional[int] = None
    comment: Optional[str] = None
    status: Optional[str] = None
    actual_start_time: Optional[datetime] = None
    time_returned_by_client: Optional[datetime] = None

class BookingInDB(BookingBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BookingOut(BookingInDB):
    pass 