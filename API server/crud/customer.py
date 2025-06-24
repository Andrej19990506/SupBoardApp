from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlalchemy import and_, or_, select
from models.customer import Customer
from schemas.customer import CustomerCreate, CustomerUpdate

class CRUDCustomer:
    async def get_customer(self, db: AsyncSession, customer_id: int) -> Optional[Customer]:
        """Получить клиента по ID"""
        result = await db.execute(select(Customer).where(Customer.id == customer_id))
        return result.scalar_one_or_none()
    
    async def get_customer_by_phone_and_owner(
        self, 
        db: AsyncSession, 
        phone: str, 
        business_owner_id: int
    ) -> Optional[Customer]:
        """Получить клиента по номеру телефона и владельцу бизнеса"""
        result = await db.execute(
            select(Customer).where(
                and_(
                    Customer.phone == phone,
                    Customer.business_owner_id == business_owner_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def get_customers_by_owner(
        self, 
        db: AsyncSession, 
        business_owner_id: int,
        skip: int = 0, 
        limit: int = 100,
        search: Optional[str] = None
    ) -> List[Customer]:
        """Получить список клиентов конкретного бизнесмена"""
        query = select(Customer).where(Customer.business_owner_id == business_owner_id)
        
        if search:
            query = query.where(
                or_(
                    Customer.name.ilike(f"%{search}%"),
                    Customer.phone.ilike(f"%{search}%")
                )
            )
        
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_customers_with_bookings(
        self, 
        db: AsyncSession, 
        business_owner_id: int,
        skip: int = 0, 
        limit: int = 100
    ) -> List[Customer]:
        """Получить клиентов с загруженными бронированиями"""
        query = select(Customer).options(joinedload(Customer.bookings))\
            .where(Customer.business_owner_id == business_owner_id)\
            .offset(skip).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def create_customer(self, db: AsyncSession, customer: CustomerCreate, business_owner_id: int) -> Customer:
        """Создать нового клиента"""
        db_customer = Customer(
            name=customer.name,
            phone=customer.phone,
            email=customer.email,
            business_owner_id=business_owner_id,
            notes=customer.notes
        )
        
        db.add(db_customer)
        await db.commit()
        await db.refresh(db_customer)
        return db_customer
    
    async def update_customer(
        self, 
        db: AsyncSession, 
        customer_id: int, 
        customer_update: CustomerUpdate,
        business_owner_id: int
    ) -> Optional[Customer]:
        """Обновить клиента (только своего)"""
        result = await db.execute(
            select(Customer).where(
                and_(
                    Customer.id == customer_id,
                    Customer.business_owner_id == business_owner_id
                )
            )
        )
        db_customer = result.scalar_one_or_none()
        
        if not db_customer:
            return None
        
        update_data = customer_update.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(db_customer, field, value)
        
        await db.commit()
        await db.refresh(db_customer)
        return db_customer
    
    async def delete_customer(self, db: AsyncSession, customer_id: int, business_owner_id: int) -> bool:
        """Удалить клиента (только своего)"""
        result = await db.execute(
            select(Customer).where(
                and_(
                    Customer.id == customer_id,
                    Customer.business_owner_id == business_owner_id
                )
            )
        )
        db_customer = result.scalar_one_or_none()
        
        if not db_customer:
            return False
        
        await db.delete(db_customer)
        await db.commit()
        return True
    
    async def update_customer_stats(
        self, 
        db: AsyncSession, 
        customer_id: int, 
        booking_count_delta: int = 0,
        spent_delta: int = 0
    ) -> Optional[Customer]:
        """Обновить статистику клиента"""
        db_customer = await self.get_customer(db, customer_id)
        if not db_customer:
            return None
        
        db_customer.total_bookings_count += booking_count_delta
        db_customer.total_spent += spent_delta
        
        # Не позволяем уйти в минус
        db_customer.total_bookings_count = max(0, db_customer.total_bookings_count)
        db_customer.total_spent = max(0, db_customer.total_spent)
        
        await db.commit()
        await db.refresh(db_customer)
        return db_customer
    
    async def get_top_customers(
        self, 
        db: AsyncSession, 
        business_owner_id: int,
        limit: int = 10,
        by_bookings: bool = True
    ) -> List[Customer]:
        """Получить топ клиентов по количеству бронирований или трате"""
        query = select(Customer).where(Customer.business_owner_id == business_owner_id)
        
        if by_bookings:
            query = query.order_by(Customer.total_bookings_count.desc())
        else:
            query = query.order_by(Customer.total_spent.desc())
        
        query = query.limit(limit)
        result = await db.execute(query)
        return result.scalars().all()

    # ========== ФУНКЦИИ ОБРАТНОЙ СОВМЕСТИМОСТИ ==========
    # Для совместимости со старой системой auth
    
    async def get_client_by_phone(self, db: AsyncSession, phone: str) -> Optional[Customer]:
        """DEPRECATED: Получить клиента по телефону (без учета business_owner_id)"""
        result = await db.execute(select(Customer).where(Customer.phone == phone))
        return result.scalar_one_or_none()
    
    async def get_client(self, db: AsyncSession, client_id: int) -> Optional[Customer]:
        """DEPRECATED: Алиас для get_customer"""
        return await self.get_customer(db, client_id)
    
    async def get_client_by_email(self, db: AsyncSession, email: str) -> Optional[Customer]:
        """DEPRECATED: Получить клиента по email"""
        result = await db.execute(select(Customer).where(Customer.email == email))
        return result.scalar_one_or_none()
    
    async def create_client(self, db: AsyncSession, client_in: CustomerCreate) -> Customer:
        """DEPRECATED: Создать клиента без business_owner_id (используется временно)"""
        db_customer = Customer(
            name=client_in.name,
            phone=client_in.phone,
            email=client_in.email,
            business_owner_id=1,  # Временно используем ID=1 как default
            notes=getattr(client_in, 'notes', None)
        )
        
        db.add(db_customer)
        await db.commit()
        await db.refresh(db_customer)
        return db_customer

# Создаем глобальный экземпляр
customer_crud = CRUDCustomer() 