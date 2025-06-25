from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db_session
from crud.booking import get_bookings, create_booking, update_booking
from crud.user import user_crud
from schemas.booking import BookingOut, BookingCreate, BookingUpdate
from typing import List, Optional
from datetime import datetime, timedelta, timezone

router = APIRouter()

async def get_current_user_optional(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получить текущего пользователя по JWT токену
    """
    if not authorization:
        return None
    
    if not authorization.startswith("Bearer "):
        return None
    
    token = authorization.replace("Bearer ", "")
    
    # Проверяем JWT токен (начинается с eyJ)
    if not token.startswith("eyJ"):
        return None
    
    try:
        from core.config import settings
        import jwt
        
        # Декодируем JWT токен
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        user_id = int(payload.get("sub"))
        
        # Получаем пользователя из базы данных
        user = await user_crud.get_user(db, user_id)
        if user:
            print(f"✅ [get_current_user_optional] Пользователь найден: ID={user.id}, Имя={user.name}")
        else:
            print(f"❌ [get_current_user_optional] Пользователь с ID={user_id} не найден в БД")
        return user
        
    except (jwt.InvalidTokenError, ValueError, TypeError) as e:
        print(f"❌ [get_current_user_optional] JWT ошибка: {e}")
        return None

@router.get("/test")
async def test_endpoint():
    """Тестовый endpoint для проверки работы роутера"""
    return {"message": "Booking router works!", "status": "ok"}

@router.get("/list", response_model=List[BookingOut])
async def list_bookings(
    status: str = Query(None, description="Фильтр по статусу (можно несколько через запятую)"),
    all_bookings: bool = Query(False, description="Показать все бронирования (только для админов)"),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_optional)
):
    """Endpoint для получения списка бронирований пользователя"""
    
    # Если пользователь не авторизован, возвращаем пустой список
    if not current_user:
        print("❌ [list_bookings] Пользователь не авторизован")
        return []
    
    print(f"✅ [list_bookings] Авторизованный пользователь: ID={current_user.id}, Имя={current_user.name}")
    
    # Получаем все бронирования
    all_user_bookings = await get_bookings(db, status_filter=status)
    print(f"🔍 [list_bookings] Всего бронирований в БД: {len(all_user_bookings)}")
    
    # Фильтруем только бронирования текущего пользователя
    user_bookings = [booking for booking in all_user_bookings if booking.business_owner_id == current_user.id]
    print(f"🔍 [list_bookings] Бронирований пользователя {current_user.id}: {len(user_bookings)}")
    
    return user_bookings

# Публичный endpoint удален для безопасности - все бронирования должны быть доступны только авторизованным пользователям

@router.post("/", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
async def add_booking(booking_in: BookingCreate, db: AsyncSession = Depends(get_db_session)):
    return await create_booking(db, booking_in)

@router.post("/create", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
async def create_booking_alt(
    booking_in: BookingCreate, 
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_optional)
):
    """Альтернативный endpoint для создания бронирования"""
    from crud.customer import customer_crud
    from schemas.customer import CustomerCreate
    
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Необходимо авторизоваться для создания бронирования"
        )
    
    # Если frontend отправил старые поля (client_name, phone) без customer_id
    if booking_in.client_name and booking_in.phone and not booking_in.customer_id:
        # Ищем существующего клиента по телефону у данного бизнесмена
        customer = await customer_crud.get_customer_by_phone_and_owner(
            db, booking_in.phone, current_user.id
        )
        
        if not customer:
            # Создаем нового клиента
            customer_data = CustomerCreate(
                name=booking_in.client_name,
                phone=booking_in.phone,
                email=None,
                notes=None
            )
            customer = await customer_crud.create_customer(db, customer_data, current_user.id)
            print(f"✅ [create_booking] Создан новый клиент: ID={customer.id}, Имя={customer.name}")
        else:
            print(f"✅ [create_booking] Найден существующий клиент: ID={customer.id}, Имя={customer.name}")
        
        # Обновляем данные бронирования
        booking_data = booking_in.dict()
        booking_data['business_owner_id'] = current_user.id
        booking_data['customer_id'] = customer.id
        
        # Создаем новый объект BookingCreate с правильными данными
        updated_booking = BookingCreate(**booking_data)
        return await create_booking(db, updated_booking)
    
    # Если frontend отправил новые поля (customer_id), проверяем принадлежность
    elif booking_in.customer_id:
        customer = await customer_crud.get_customer(db, booking_in.customer_id)
        if not customer or customer.business_owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Указанный клиент не найден или не принадлежит вам"
            )
        
        # Устанавливаем business_owner_id
        booking_data = booking_in.dict()
        booking_data['business_owner_id'] = current_user.id
        
        updated_booking = BookingCreate(**booking_data)
        return await create_booking(db, updated_booking)
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо указать данные клиента (client_name + phone или customer_id)"
        )

@router.patch("/{booking_id}", response_model=BookingOut)
async def patch_booking(booking_id: int, booking_in: BookingUpdate, db: AsyncSession = Depends(get_db_session)):
    booking = await update_booking(db, booking_id, booking_in)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

@router.get("/fully-booked-days")
async def get_fully_booked_days(
    from_date: str = Query(..., description="Дата начала периода, формат YYYY-MM-DD"),
    to_date: str = Query(..., description="Дата конца периода, формат YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Возвращает список дат (YYYY-MM-DD), когда все доски заняты в указанный период.
    День считается полностью занятым, если на КАЖДЫЙ 5-минутный интервал нет ни одной свободной доски.
    
    ОБНОВЛЕНО: Использует новую гибкую систему инвентаря с selected_items
    Учитывает только инвентарь с affects_availability=true (SUP доски)
    """
    from crud.inventory import get_inventory_stats, get_inventory_types
    from crud.booking import get_bookings
    
    # Получаем типы инвентаря которые влияют на доступность
    inventory_types = await get_inventory_types(db)
    availability_affecting_types = {
        str(inv_type.id): inv_type.board_equivalent 
        for inv_type in inventory_types 
        if inv_type.affects_availability
    }
    
    # Получаем общее количество основного инвентаря (только влияющего на доступность)
    inventory_stats = await get_inventory_stats(db)
    
    # Считаем только инвентарь который влияет на доступность
    total_boards = 0
    for type_id, type_stats in inventory_stats.get('by_type', {}).items():
        if str(type_id) in availability_affecting_types:
            total_boards += type_stats.get('total', 0) * availability_affecting_types[str(type_id)]
    
    # Fallback если нет данных
    if total_boards == 0:
        total_boards = 12  # Fallback на 12 SUP досок
    
    fully_booked_days = []
    start = datetime.strptime(from_date, "%Y-%m-%d")
    end = datetime.strptime(to_date, "%Y-%m-%d")
    day_count = (end - start).days + 1
    interval_minutes = 5
    intervals_per_day = 24 * 60 // interval_minutes
    
    # Получаем все бронирования за период
    all_bookings = await get_bookings(db)
    
    for i in range(day_count):
        day = start + timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
        fully_booked = True
        
        for interval in range(intervals_per_day):
            interval_start = day_start + timedelta(minutes=interval * interval_minutes)
            interval_end = interval_start + timedelta(minutes=interval_minutes)
            
            boards_taken = 0
            for b in all_bookings:
                b_start = b.planned_start_time
                b_end = b_start + timedelta(hours=b.duration_in_hours + 1)  # +1 час на обслуживание
                
                if b_start < interval_end and b_end > interval_start:
                    # НОВАЯ СИСТЕМА: учитываем только инвентарь влияющий на доступность
                    if hasattr(b, 'selected_items') and b.selected_items:
                        boards_for_this_booking = 0
                        for type_id, quantity in b.selected_items.items():
                            if str(type_id) in availability_affecting_types:
                                # Учитываем board_equivalent (сколько "досок" эквивалентно одной единице)
                                boards_for_this_booking += quantity * availability_affecting_types[str(type_id)]
                    else:
                        # Fallback на старую систему для совместимости
                        boards_for_this_booking = (b.board_count or 0) + (b.board_with_seat_count or 0)
                        if hasattr(b, 'service_type') and b.service_type == 'RENT':
                            boards_for_this_booking += (b.raft_count or 0) * 2
                        else:
                            boards_for_this_booking += (b.raft_count or 0)
                    
                    boards_taken += boards_for_this_booking
            
            if boards_taken < total_boards:
                fully_booked = False
                break
        
        if fully_booked:
            fully_booked_days.append(day.strftime("%Y-%m-%d"))
    
    return fully_booked_days

@router.get("/availability")
async def get_day_availability(
    date: str = Query(..., description="Дата, формат YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Возвращает, есть ли свободные доски на указанный день.
    ОБНОВЛЕНО: Использует новую гибкую систему инвентаря
    """
    from crud.inventory import get_inventory_stats
    
    # Получаем статистику инвентаря
    inventory_stats = await get_inventory_stats(db)
    total_boards = inventory_stats.get('total_items', 12)  # Fallback на 12
    
    # Простая проверка - есть ли хотя бы одна свободная единица инвентаря
    available_boards = inventory_stats.get('available_items', total_boards)
    
    return {
        "date": date, 
        "is_fully_booked": available_boards == 0, 
        "free_boards": available_boards,
        "total_boards": total_boards
    }

@router.get("/days-availability")
async def get_days_availability(
    from_date: str = Query(..., description="Дата начала периода, формат YYYY-MM-DD"),
    to_date: str = Query(..., description="Дата конца периода, формат YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Возвращает:
    - fully_booked_days: список дат, когда все доски заняты на каждый 5-минутный интервал
    - partially_booked_days: список объектов {date, available_after}, где available_after — время первого свободного интервала (UTC+7)
    
    ОБНОВЛЕНО: Использует новую гибкую систему инвентаря с selected_items
    Учитывает только инвентарь с affects_availability=true (SUP доски)
    """
    from crud.inventory import get_inventory_stats, get_inventory_types
    from crud.booking import get_bookings
    
    # Получаем типы инвентаря которые влияют на доступность
    inventory_types = await get_inventory_types(db)
    availability_affecting_types = {
        str(inv_type.id): inv_type.board_equivalent 
        for inv_type in inventory_types 
        if inv_type.affects_availability
    }
    
    # Получаем общее количество основного инвентаря (только влияющего на доступность)
    inventory_stats = await get_inventory_stats(db)
    
    # Считаем только инвентарь который влияет на доступность
    total_boards = 0
    for type_id, type_stats in inventory_stats.get('by_type', {}).items():
        if str(type_id) in availability_affecting_types:
            total_boards += type_stats.get('total', 0) * availability_affecting_types[str(type_id)]
    
    # Fallback если нет данных
    if total_boards == 0:
        total_boards = 12  # Fallback на 12 SUP досок
    
    fully_booked_days = []
    partially_booked_days = []
    start = datetime.strptime(from_date, "%Y-%m-%d")
    end = datetime.strptime(to_date, "%Y-%m-%d")
    day_count = (end - start).days + 1
    interval_minutes = 5
    work_start_hour_utc = 2   # 09:00 Красноярск
    work_end_hour_utc = 16    # 23:00 Красноярск
    
    # Получаем все бронирования за период одним запросом
    all_bookings = await get_bookings(db)
    
    # Фильтруем только те, что пересекаются с нужным диапазоном
    period_start = start.replace(hour=work_start_hour_utc, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
    period_end = (end + timedelta(days=1)).replace(hour=work_end_hour_utc, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
    
    relevant_bookings = []
    for b in all_bookings:
        booking_start = b.planned_start_time
        booking_end = booking_start + timedelta(hours=b.duration_in_hours)
        if booking_end > period_start and booking_start < period_end:
            relevant_bookings.append(b)
    
    for i in range(day_count):
        day = start + timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
        work_start = day_start + timedelta(hours=work_start_hour_utc)
        work_end = day_start + timedelta(hours=work_end_hour_utc)
        
        intervals_per_day = (work_end_hour_utc - work_start_hour_utc) * 60 // interval_minutes
        interval_is_free = []
        
        for interval in range(intervals_per_day):
            interval_start = work_start + timedelta(minutes=interval * interval_minutes)
            interval_end = interval_start + timedelta(minutes=interval_minutes)
            boards_taken = 0
            
            for b in relevant_bookings:
                b_start = b.planned_start_time
                b_end = b_start + timedelta(hours=b.duration_in_hours + 1)  # +1 час на обслуживание
                
                if b_start < interval_end and b_end > interval_start:
                    # НОВАЯ СИСТЕМА: учитываем только инвентарь влияющий на доступность
                    if hasattr(b, 'selected_items') and b.selected_items:
                        boards_for_this_booking = 0
                        for type_id, quantity in b.selected_items.items():
                            if str(type_id) in availability_affecting_types:
                                # Учитываем board_equivalent (сколько "досок" эквивалентно одной единице)
                                boards_for_this_booking += quantity * availability_affecting_types[str(type_id)]
                    else:
                        # Fallback на старую систему для совместимости
                        boards_for_this_booking = (b.board_count or 0) + (b.board_with_seat_count or 0)
                        if hasattr(b, 'service_type') and b.service_type == 'RENT':
                            boards_for_this_booking += (b.raft_count or 0) * 2
                        else:
                            boards_for_this_booking += (b.raft_count or 0)
                    
                    boards_taken += boards_for_this_booking
            
            interval_is_free.append(boards_taken < total_boards)
        
        # --- Блок анализа свободных окон ---
        min_rent_intervals = 24 * 60 // interval_minutes  # 24ч
        min_rafting_intervals = 4 * 60 // interval_minutes  # 4ч
        
        free_windows = []
        free_windows_times = []
        cur_streak = 0
        streak_start = None
        first_available = None
        
        for idx, is_free in enumerate(interval_is_free):
            if is_free:
                if cur_streak == 0:
                    streak_start = idx
                    if first_available is None:
                        first_available = work_start + timedelta(minutes=idx * interval_minutes)
                cur_streak += 1
            else:
                if cur_streak > 0:
                    free_windows.append(cur_streak)
                    start_time = work_start + timedelta(minutes=streak_start * interval_minutes)
                    end_time = work_start + timedelta(minutes=(idx) * interval_minutes)
                    free_windows_times.append((start_time, end_time, cur_streak))
                cur_streak = 0
                streak_start = None
        
        if cur_streak > 0:
            free_windows.append(cur_streak)
            start_time = work_start + timedelta(minutes=streak_start * interval_minutes)
            end_time = work_start + timedelta(minutes=(intervals_per_day) * interval_minutes)
            free_windows_times.append((start_time, end_time, cur_streak))
        
        # --- Определяем статус дня ---
        all_intervals_free = all(interval_is_free)
        has_rent_window = any(w >= min_rent_intervals for w in free_windows)
        has_rafting_window = any(w >= min_rafting_intervals for w in free_windows)
        
        if has_rent_window or has_rafting_window:
            if first_available is not None and not all_intervals_free:
                available_after_krsk = (first_available + timedelta(hours=7)).time()
                partially_booked_days.append({
                    "date": day.strftime("%Y-%m-%d"),
                    "available_after": available_after_krsk.strftime("%H:%M")
                })
        else:
            fully_booked_days.append(day.strftime("%Y-%m-%d"))
    
    return {"fully_booked_days": fully_booked_days, "partially_booked_days": partially_booked_days} 