from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class BoardBase(BaseModel):
    status: str
    current_booking_id: Optional[str] = None
    last_service_end: Optional[datetime] = None

class BoardCreate(BoardBase):
    pass

class BoardUpdate(BaseModel):
    status: Optional[str] = None
    current_booking_id: Optional[str] = None

class BoardInDB(BoardBase):
    id: int

    class Config:
        from_attributes = True

class BoardOut(BoardInDB):
    pass 