from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from db.session import get_db_session
from crud.inventory import (
    get_inventory_types, get_inventory_type, create_inventory_type, 
    create_inventory_type_with_items, update_inventory_type, delete_inventory_type,
    get_inventory_items, get_inventory_item, create_inventory_item,
    update_inventory_item, delete_inventory_item, get_inventory_stats,
    get_available_inventory_counts
)
from schemas.inventory import (
    InventoryTypeOut, InventoryTypeCreate, InventoryTypeUpdate, InventoryTypeQuickCreate,
    InventoryTypeWithItems, InventoryItemOut, InventoryItemCreate, InventoryItemUpdate,
    InventoryStats
)

router = APIRouter()

# Эндпоинты для типов инвентаря
@router.get("/types", response_model=List[InventoryTypeOut])
async def read_inventory_types(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db_session)
):
    """Получить все типы инвентаря"""
    return await get_inventory_types(db, skip=skip, limit=limit, include_inactive=include_inactive)

@router.get("/types/{type_id}", response_model=InventoryTypeWithItems)
async def read_inventory_type(
    type_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """Получить тип инвентаря по ID с единицами"""
    inventory_type = await get_inventory_type(db, type_id)
    if not inventory_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тип инвентаря не найден"
        )
    return inventory_type

@router.post("/types", response_model=InventoryTypeOut, status_code=status.HTTP_201_CREATED)
async def create_new_inventory_type(
    inventory_type: InventoryTypeCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """Создать новый тип инвентаря"""
    return await create_inventory_type(db, inventory_type)

@router.post("/types/quick", response_model=InventoryTypeOut, status_code=status.HTTP_201_CREATED)
async def create_inventory_type_quick(
    inventory_data: InventoryTypeQuickCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """Быстро создать тип инвентаря с начальными единицами"""
    return await create_inventory_type_with_items(db, inventory_data)

@router.patch("/types/{type_id}", response_model=InventoryTypeOut)
async def update_existing_inventory_type(
    type_id: int,
    inventory_type: InventoryTypeUpdate,
    db: AsyncSession = Depends(get_db_session)
):
    """Обновить тип инвентаря"""
    updated_type = await update_inventory_type(db, type_id, inventory_type)
    if not updated_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тип инвентаря не найден"
        )
    return updated_type

@router.delete("/types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_inventory_type(
    type_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """Удалить тип инвентаря (только если нет единиц)"""
    success = await delete_inventory_type(db, type_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить тип инвентаря с существующими единицами"
        )

# Эндпоинты для единиц инвентаря
@router.get("/items", response_model=List[InventoryItemOut])
async def read_inventory_items(
    type_id: Optional[int] = Query(None, description="Фильтр по типу инвентаря"),
    status: Optional[str] = Query(None, description="Фильтр по статусу"),
    db: AsyncSession = Depends(get_db_session)
):
    """Получить единицы инвентаря с фильтрацией"""
    return await get_inventory_items(db, type_id=type_id, status=status)

@router.get("/items/{item_id}", response_model=InventoryItemOut)
async def read_inventory_item(
    item_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """Получить единицу инвентаря по ID"""
    item = await get_inventory_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Единица инвентаря не найдена"
        )
    return item

@router.post("/items", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
async def create_new_inventory_item(
    inventory_item: InventoryItemCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """Создать новую единицу инвентаря"""
    # Проверяем, существует ли тип инвентаря
    inventory_type = await get_inventory_type(db, inventory_item.inventory_type_id)
    if not inventory_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Указанный тип инвентаря не существует"
        )
    
    return await create_inventory_item(db, inventory_item)

@router.patch("/items/{item_id}", response_model=InventoryItemOut)
async def update_existing_inventory_item(
    item_id: int,
    inventory_item: InventoryItemUpdate,
    db: AsyncSession = Depends(get_db_session)
):
    """Обновить единицу инвентаря"""
    updated_item = await update_inventory_item(db, item_id, inventory_item)
    if not updated_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Единица инвентаря не найдена"
        )
    return updated_item

@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_inventory_item(
    item_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """Удалить единицу инвентаря"""
    success = await delete_inventory_item(db, item_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Единица инвентаря не найдена"
        )

# Статистика и служебные эндпоинты
@router.get("/stats", response_model=InventoryStats)
async def read_inventory_stats(db: AsyncSession = Depends(get_db_session)):
    """Получить статистику инвентаря"""
    return await get_inventory_stats(db)

@router.get("/availability")
async def read_inventory_availability(db: AsyncSession = Depends(get_db_session)):
    """Получить количество доступного инвентаря по типам"""
    return await get_available_inventory_counts(db)

# Массовые операции
@router.post("/items/bulk", response_model=List[InventoryItemOut], status_code=status.HTTP_201_CREATED)
async def create_multiple_inventory_items(
    type_id: int,
    quantity: int = Query(..., ge=1, le=50, description="Количество единиц для создания"),
    name_prefix: Optional[str] = Query(None, description="Префикс для названий"),
    db: AsyncSession = Depends(get_db_session)
):
    """Создать несколько единиц инвентаря одного типа"""
    from crud.inventory import create_multiple_inventory_items as crud_create_multiple
    
    # Проверяем, существует ли тип инвентаря
    inventory_type = await get_inventory_type(db, type_id)
    if not inventory_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Указанный тип инвентаря не существует"
        )
    
    base_name = name_prefix or inventory_type.display_name
    created_items = await crud_create_multiple(db, type_id, quantity, base_name)
    
    return created_items 