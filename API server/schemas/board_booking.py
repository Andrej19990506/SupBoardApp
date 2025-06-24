from pydantic import BaseModel

class BoardBookingBase(BaseModel):
    board_id: int
    booking_id: int

class BoardBookingCreate(BoardBookingBase):
    pass

class BoardBooking(BoardBookingBase):
    id: int

    class Config:
        from_attributes = True