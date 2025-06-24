# models/board_booking.py


from sqlalchemy import Column, ForeignKey, Integer
from models.base import Base

class BoardBooking(Base):
    __tablename__ = "board_bookings"
    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)