from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.booking import Booking
from schemas.booking import BookingCreate, BookingUpdate
from fastapi import HTTPException
from datetime import timedelta, timezone
from typing import Optional, List

async def get_bookings(db: AsyncSession, status_filter: str = None, customer_id: Optional[int] = None):
    """Получить список бронирований с фильтрацией"""
    query = select(Booking)
    
    if status_filter:
        # Поддерживаем фильтрацию по одному или нескольким статусам через запятую
        statuses = [s.strip() for s in status_filter.split(',')]
        query = query.where(Booking.status.in_(statuses))
    
    if customer_id:
        query = query.where(Booking.customer_id == customer_id)
    
    result = await db.execute(query)
    return result.scalars().all()

async def get_booking_by_id(db: AsyncSession, booking_id: int) -> Optional[Booking]:
    """Получить бронирование по ID"""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    return result.scalar_one_or_none()

async def create_booking(db: AsyncSession, booking_in: BookingCreate):
    """Создать новое бронирование"""
    # Создаем бронирование
    booking_data = booking_in.dict()
    
    booking = Booking(**booking_data)
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    
    return booking

async def update_booking(db: AsyncSession, booking_id: int, booking_in: BookingUpdate):
    """Обновить существующее бронирование"""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        return None
    
    # Обновляем поля бронирования
    for field, value in booking_in.dict(exclude_unset=True).items():
        setattr(booking, field, value)
    
    await db.commit()
    await db.refresh(booking)
    return booking

async def delete_booking(db: AsyncSession, booking_id: int) -> bool:
    """Удалить бронирование"""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        return False
    
    await db.delete(booking)
    await db.commit()
    return True

async def get_bookings_by_date_range(
    db: AsyncSession, 
    start_date, 
    end_date, 
    status_filter: Optional[str] = None
) -> List[Booking]:
    """Получить бронирования в диапазоне дат"""
    query = select(Booking).where(
        Booking.planned_start_time >= start_date,
        Booking.planned_start_time <= end_date
    )
    
    if status_filter:
        statuses = [s.strip() for s in status_filter.split(',')]
        query = query.where(Booking.status.in_(statuses))
    
    result = await db.execute(query)
    return result.scalars().all()

async def get_booking_inventory_usage(booking: Booking) -> int:
    """Получить количество используемого инвентаря в бронировании"""
    if hasattr(booking, 'selected_items') and booking.selected_items:
        # Новая система с гибким инвентарем
        return sum(item.get('count', 0) for item in booking.selected_items)
    else:
        # Fallback для старых бронирований
        total = 0
        if hasattr(booking, 'board_count') and booking.board_count:
            total += booking.board_count
        if hasattr(booking, 'board_with_seat_count') and booking.board_with_seat_count:
            total += booking.board_with_seat_count
        if hasattr(booking, 'raft_count') and booking.raft_count:
            total += booking.raft_count
        return total 