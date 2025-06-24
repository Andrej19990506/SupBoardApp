from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from db.session import get_db_session
from crud.customer import customer_crud
from schemas.customer import (
    Customer, CustomerCreate, CustomerUpdate, CustomerWithStats,
    CustomerSearch, CustomerListResponse
)
from schemas.user import User
from core.dependencies import get_current_user

router = APIRouter()

@router.post("/", response_model=Customer, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer_data: CustomerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Создать нового клиента
    """
    # Проверяем, что клиент с таким номером не существует у данного бизнесмена
    existing_customer = await customer_crud.get_customer_by_phone_and_owner(
        db, customer_data.phone, current_user.id
    )
    if existing_customer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Клиент с таким номером телефона уже существует"
        )
    
    return await customer_crud.create_customer(db, customer_data, current_user.id)

@router.get("/", response_model=CustomerListResponse)
async def get_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получить список клиентов текущего бизнесмена
    """
    customers = await customer_crud.get_customers_by_owner(
        db, 
        business_owner_id=current_user.id,
        skip=skip, 
        limit=limit, 
        search=search
    )
    
    # Подсчитываем общее количество для пагинации
    # TODO: Добавить отдельный метод для подсчета
    total = len(await customer_crud.get_customers_by_owner(db, current_user.id, skip=0, limit=10000))
    
    return CustomerListResponse(
        customers=customers,
        total=total,
        skip=skip,
        limit=limit
    )

@router.get("/top", response_model=List[CustomerWithStats])
async def get_top_customers(
    limit: int = Query(10, ge=1, le=50),
    by_bookings: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получить топ клиентов по количеству бронирований или трате
    """
    customers = await customer_crud.get_top_customers(
        db, 
        business_owner_id=current_user.id,
        limit=limit,
        by_bookings=by_bookings
    )
    
    # Преобразуем в CustomerWithStats и добавляем вычисляемые поля
    result = []
    for customer in customers:
        customer_stats = CustomerWithStats.from_orm(customer)
        customer_stats.spent_rub = customer.total_spent / 100.0  # Копейки в рубли
        customer_stats.is_vip = customer.total_bookings_count >= 5
        # TODO: Добавить last_booking_date из связанных бронирований
        result.append(customer_stats)
    
    return result

@router.get("/search", response_model=List[Customer])
async def search_customers_get(
    q: Optional[str] = Query(None, description="Поисковая строка"),
    limit: int = Query(10, ge=1, le=100, description="Лимит результатов"),
    skip: int = Query(0, ge=0, description="Смещение"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Поиск клиентов по имени или телефону (GET endpoint для фронтенда)
    """
    print(f"🔍 [customer search] User ID: {current_user.id}, Query: '{q}', Limit: {limit}")
    
    customers = await customer_crud.get_customers_by_owner(
        db,
        business_owner_id=current_user.id,
        skip=skip,
        limit=limit,
        search=q  # q параметр который ожидает фронтенд
    )
    
    print(f"✅ [customer search] Найдено клиентов: {len(customers)}")
    for customer in customers:
        print(f"   - ID={customer.id}, Name='{customer.name}', Phone='{customer.phone}'")
    
    return customers

@router.get("/{customer_id}", response_model=CustomerWithStats)
async def get_customer(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Получить клиента по ID (только своего)
    """
    customer = await customer_crud.get_customer(db, customer_id)
    if not customer or customer.business_owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден"
        )
    
    # Добавляем вычисляемые поля
    customer_stats = CustomerWithStats.from_orm(customer)
    customer_stats.spent_rub = customer.total_spent / 100.0
    customer_stats.is_vip = customer.total_bookings_count >= 5
    
    return customer_stats

@router.put("/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: int,
    customer_update: CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Обновить клиента (только своего)
    """
    # Проверяем, что телефон не занят другим клиентом
    if customer_update.phone:
        existing_customer = await customer_crud.get_customer_by_phone_and_owner(
            db, customer_update.phone, current_user.id
        )
        if existing_customer and existing_customer.id != customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Клиент с таким номером телефона уже существует"
            )
    
    updated_customer = await customer_crud.update_customer(
        db, customer_id, customer_update, current_user.id
    )
    if not updated_customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден"
        )
    
    return updated_customer

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Удалить клиента (только своего)
    """
    success = await customer_crud.delete_customer(db, customer_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден"
        )

@router.post("/search", response_model=List[Customer])
async def search_customers_post(
    search_params: CustomerSearch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Поиск клиентов по различным критериям (POST endpoint)
    """
    customers = await customer_crud.get_customers_by_owner(
        db,
        business_owner_id=current_user.id,
        skip=search_params.skip,
        limit=search_params.limit,
        search=search_params.search
    )
    
    return customers 