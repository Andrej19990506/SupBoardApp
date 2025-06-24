from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SeatBase(BaseModel):
    status: str
    current_booking_id: Optional[str] = None
    last_service_end: Optional[datetime] = None

class SeatCreate(SeatBase):
    pass

class SeatUpdate(BaseModel):
    status: Optional[str] = None
    current_booking_id: Optional[str] = None

class SeatInDB(SeatBase):
    id: int

    class Config:
        from_attributes = True

class SeatOut(SeatInDB):
    pass 