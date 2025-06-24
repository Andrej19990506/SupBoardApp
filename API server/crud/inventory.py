from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_, case
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from models.inventory_type import InventoryType, InventoryItem
from schemas.inventory import (
    InventoryTypeCreate, InventoryTypeUpdate, InventoryTypeQuickCreate,
    InventoryItemCreate, InventoryItemUpdate
)

# CRUD для типов инвентаря
async def get_inventory_types(db: AsyncSession, skip: int = 0, limit: int = 100, include_inactive: bool = False) -> List[InventoryType]:
    """Получить все типы инвентаря"""
    query = select(InventoryType).options(selectinload(InventoryType.items))
    
    if not include_inactive:
        query = query.where(InventoryType.is_active == True)
    
    query = query.offset(skip).limit(limit).order_by(InventoryType.display_name)
    result = await db.execute(query)
    types = result.scalars().all()
    
    # Добавляем расчет счетчиков для каждого типа
    for inventory_type in types:
        items_count = len(inventory_type.items) if inventory_type.items else 0
        available_count = len([item for item in inventory_type.items if item.status == 'available']) if inventory_type.items else 0
        
        # Добавляем атрибуты динамически
        inventory_type.items_count = items_count
        inventory_type.available_count = available_count
    
    return types

async def get_inventory_type(db: AsyncSession, type_id: int) -> Optional[InventoryType]:
    """Получить тип инвентаря по ID"""
    query = select(InventoryType).options(selectinload(InventoryType.items)).where(InventoryType.id == type_id)
    result = await db.execute(query)
    inventory_type = result.scalar_one_or_none()
    
    if inventory_type:
        # Добавляем расчет счетчиков
        items_count = len(inventory_type.items) if inventory_type.items else 0
        available_count = len([item for item in inventory_type.items if item.status == 'available']) if inventory_type.items else 0
        
        # Добавляем атрибуты динамически
        inventory_type.items_count = items_count
        inventory_type.available_count = available_count
    
    return inventory_type

async def create_inventory_type(db: AsyncSession, inventory_type: InventoryTypeCreate) -> InventoryType:
    """Создать новый тип инвентаря"""
    db_inventory_type = InventoryType(**inventory_type.model_dump())
    db.add(db_inventory_type)
    await db.commit()
    await db.refresh(db_inventory_type)
    return db_inventory_type

async def create_inventory_type_with_items(db: AsyncSession, inventory_data: InventoryTypeQuickCreate) -> InventoryType:
    """Создать тип инвентаря с начальными единицами"""
    # Создаем тип инвентаря
    type_data = inventory_data.model_dump(exclude={'initial_quantity'})
    db_inventory_type = InventoryType(**type_data)
    db.add(db_inventory_type)
    await db.flush()  # Получаем ID без коммита
    
    # Создаем единицы инвентаря
    for i in range(inventory_data.initial_quantity):
        item_name = f"{inventory_data.display_name} #{i + 1}"
        db_item = InventoryItem(
            inventory_type_id=db_inventory_type.id,
            name=item_name,
            status='available'
        )
        db.add(db_item)
    
    await db.commit()
    
    # Загружаем созданный тип с единицами
    query = select(InventoryType).options(selectinload(InventoryType.items)).where(InventoryType.id == db_inventory_type.id)
    result = await db.execute(query)
    return result.scalar_one()

async def update_inventory_type(db: AsyncSession, type_id: int, inventory_type: InventoryTypeUpdate) -> Optional[InventoryType]:
    """Обновить тип инвентаря"""
    query = update(InventoryType).where(InventoryType.id == type_id).values(**inventory_type.model_dump(exclude_unset=True))
    await db.execute(query)
    await db.commit()
    return await get_inventory_type(db, type_id)

async def delete_inventory_type(db: AsyncSession, type_id: int) -> bool:
    """Удалить тип инвентаря (только если нет единиц)"""
    # Проверяем, есть ли единицы этого типа
    items_query = select(func.count(InventoryItem.id)).where(InventoryItem.inventory_type_id == type_id)
    items_count = await db.execute(items_query)
    
    if items_count.scalar() > 0:
        return False  # Нельзя удалить тип с существующими единицами
    
    query = delete(InventoryType).where(InventoryType.id == type_id)
    result = await db.execute(query)
    await db.commit()
    return result.rowcount > 0

# CRUD для единиц инвентаря
async def get_inventory_items(db: AsyncSession, type_id: Optional[int] = None, status: Optional[str] = None) -> List[InventoryItem]:
    """Получить единицы инвентаря с фильтрацией"""
    query = select(InventoryItem).options(selectinload(InventoryItem.inventory_type))
    
    if type_id:
        query = query.where(InventoryItem.inventory_type_id == type_id)
    
    if status:
        query = query.where(InventoryItem.status == status)
    
    query = query.order_by(InventoryItem.inventory_type_id, InventoryItem.id)
    result = await db.execute(query)
    return result.scalars().all()

async def get_inventory_item(db: AsyncSession, item_id: int) -> Optional[InventoryItem]:
    """Получить единицу инвентаря по ID"""
    query = select(InventoryItem).options(selectinload(InventoryItem.inventory_type)).where(InventoryItem.id == item_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def create_inventory_item(db: AsyncSession, inventory_item: InventoryItemCreate) -> InventoryItem:
    """Создать новую единицу инвентаря"""
    db_inventory_item = InventoryItem(**inventory_item.model_dump())
    db.add(db_inventory_item)
    await db.commit()
    await db.refresh(db_inventory_item)
    return db_inventory_item

async def update_inventory_item(db: AsyncSession, item_id: int, inventory_item: InventoryItemUpdate) -> Optional[InventoryItem]:
    """Обновить единицу инвентаря"""
    query = update(InventoryItem).where(InventoryItem.id == item_id).values(**inventory_item.model_dump(exclude_unset=True))
    await db.execute(query)
    await db.commit()
    return await get_inventory_item(db, item_id)

async def delete_inventory_item(db: AsyncSession, item_id: int) -> bool:
    """Удалить единицу инвентаря"""
    query = delete(InventoryItem).where(InventoryItem.id == item_id)
    result = await db.execute(query)
    await db.commit()
    return result.rowcount > 0

async def create_multiple_inventory_items(db: AsyncSession, type_id: int, quantity: int, base_name: str) -> List[InventoryItem]:
    """Создать несколько единиц инвентаря одного типа (оптимизированно)"""
    # Создаем все единицы за один раз
    items_to_create = []
    for i in range(quantity):
        item = InventoryItem(
            inventory_type_id=type_id,
            name=f"{base_name} #{i + 1}",
            status="available"
        )
        items_to_create.append(item)
    
    # Добавляем все единицы в сессию
    db.add_all(items_to_create)
    await db.commit()
    
    # Загружаем созданные единицы с типом инвентаря
    created_ids = [item.id for item in items_to_create]
    query = select(InventoryItem).options(selectinload(InventoryItem.inventory_type)).where(
        InventoryItem.id.in_(created_ids)
    )
    result = await db.execute(query)
    return result.scalars().all()

# Статистика инвентаря
async def get_inventory_stats(db: AsyncSession) -> Dict[str, Any]:
    """Получить статистику инвентаря"""
    # Общая статистика - только для критически важного инвентаря (affects_availability = True)
    total_types_query = select(func.count(InventoryType.id)).where(InventoryType.is_active == True)
    
    # Для общих счетчиков считаем только критически важный инвентарь
    critical_items_base = select(InventoryItem).join(InventoryType).where(
        and_(
            InventoryType.is_active == True,
            InventoryType.affects_availability == True
        )
    )
    
    total_items_query = select(func.count()).select_from(critical_items_base.subquery())
    available_items_query = select(func.count()).select_from(
        critical_items_base.where(InventoryItem.status == 'available').subquery()
    )
    in_use_items_query = select(func.count()).select_from(
        critical_items_base.where(InventoryItem.status == 'in_use').subquery()
    )
    servicing_items_query = select(func.count()).select_from(
        critical_items_base.where(InventoryItem.status == 'servicing').subquery()
    )
    repair_items_query = select(func.count()).select_from(
        critical_items_base.where(InventoryItem.status == 'repair').subquery()
    )
    
    total_types = (await db.execute(total_types_query)).scalar()
    total_items = (await db.execute(total_items_query)).scalar()
    available_items = (await db.execute(available_items_query)).scalar()
    in_use_items = (await db.execute(in_use_items_query)).scalar()
    servicing_items = (await db.execute(servicing_items_query)).scalar()
    repair_items = (await db.execute(repair_items_query)).scalar()
    
    print(f"🔍 DEBUG: Статистика критически важного инвентаря:")
    print(f"  - Всего единиц: {total_items}")
    print(f"  - Доступно: {available_items}")
    print(f"  - В использовании: {in_use_items}")
    
    # Статистика по типам - упрощенный запрос
    by_type_query = select(
        InventoryType.name,
        InventoryType.display_name,
        func.count(InventoryItem.id).label('total'),
        func.sum(case((InventoryItem.status == 'available', 1), else_=0)).label('available'),
        func.sum(case((InventoryItem.status == 'in_use', 1), else_=0)).label('in_use'),
        func.sum(case((InventoryItem.status == 'servicing', 1), else_=0)).label('servicing'),
        func.sum(case((InventoryItem.status == 'repair', 1), else_=0)).label('repair')
    ).select_from(
        InventoryType.__table__.outerjoin(InventoryItem.__table__, InventoryType.id == InventoryItem.inventory_type_id)
    ).where(
        InventoryType.is_active == True
    ).group_by(InventoryType.id, InventoryType.name, InventoryType.display_name)
    
    by_type_result = await db.execute(by_type_query)
    by_type = {}
    
    print(f"🔍 DEBUG: Результаты запроса статистики по типам:")
    for row in by_type_result:
        print(f"  - {row.name} ({row.display_name}): total={row.total}, available={row.available}, in_use={row.in_use}, servicing={row.servicing}, repair={row.repair}")
        by_type[row.name] = {
            "display_name": row.display_name,
            "total": int(row.total or 0),
            "available": int(row.available or 0),
            "in_use": int(row.in_use or 0),
            "servicing": int(row.servicing or 0),
            "repair": int(row.repair or 0)
        }
    
    print(f"🔍 DEBUG: Итоговая статистика by_type: {by_type}")
    
    return {
        'total_types': total_types,
        'total_items': total_items,
        'available_items': available_items,
        'in_use_items': in_use_items,
        'servicing_items': servicing_items,
        'repair_items': repair_items,
        'by_type': by_type
    }

# Операции с доступностью инвентаря
async def get_available_inventory_counts(db: AsyncSession) -> Dict[str, int]:
    """Получить количество доступного инвентаря по типам"""
    query = select(
        InventoryType.name,
        func.count(InventoryItem.id).label('available_count')
    ).select_from(
        InventoryType.__table__.join(InventoryItem.__table__)
    ).where(
        and_(
            InventoryType.is_active == True,
            InventoryItem.status == 'available'
        )
    ).group_by(InventoryType.id, InventoryType.name)
    
    result = await db.execute(query)
    return {row.name: row.available_count for row in result}

async def reserve_inventory_items(db: AsyncSession, reservations: Dict[str, int], booking_id: str) -> Dict[str, List[int]]:
    """Зарезервировать единицы инвентаря для бронирования"""
    reserved_items = {}
    
    for type_name, quantity in reservations.items():
        # Находим доступные единицы этого типа
        query = select(InventoryItem.id).join(InventoryType).where(
            and_(
                InventoryType.name == type_name,
                InventoryItem.status == 'available'
            )
        ).limit(quantity)
        
        result = await db.execute(query)
        available_items = result.scalars().all()
        
        if len(available_items) < quantity:
            # Не хватает инвентаря - откатываем все изменения
            await db.rollback()
            raise ValueError(f"Недостаточно единиц типа {type_name}: требуется {quantity}, доступно {len(available_items)}")
        
        # Резервируем единицы
        update_query = update(InventoryItem).where(
            InventoryItem.id.in_(available_items)
        ).values(
            status='booked',
            current_booking_id=booking_id
        )
        
        await db.execute(update_query)
        reserved_items[type_name] = available_items
    
    await db.commit()
    return reserved_items 