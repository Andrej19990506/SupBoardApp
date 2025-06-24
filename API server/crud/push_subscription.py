from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, or_, select
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json

from models.push_subscription import PushSubscription
from schemas.push_subscription import PushSubscriptionCreate, PushSubscriptionUpdate

class CRUDPushSubscription:
    async def create(self, db: AsyncSession, *, obj_in: PushSubscriptionCreate, ip_address: Optional[str] = None) -> PushSubscription:
        """Создать новую подписку"""
        db_obj = PushSubscription(
            endpoint=obj_in.endpoint,
            p256dh=obj_in.keys.p256dh,
            auth=obj_in.keys.auth,
            user_agent=obj_in.user_agent,
            ip_address=ip_address,
            notification_types=obj_in.notification_types
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def get(self, db: AsyncSession, id: int) -> Optional[PushSubscription]:
        """Получить подписку по ID"""
        result = await db.execute(select(PushSubscription).filter(PushSubscription.id == id))
        return result.scalar_one_or_none()
    
    async def get_by_endpoint(self, db: AsyncSession, endpoint: str) -> Optional[PushSubscription]:
        """Получить подписку по endpoint"""
        result = await db.execute(select(PushSubscription).filter(PushSubscription.endpoint == endpoint))
        return result.scalar_one_or_none()
    
    async def get_active(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[PushSubscription]:
        """Получить все активные подписки"""
        result = await db.execute(
            select(PushSubscription).filter(
                and_(
                    PushSubscription.is_active == True,
                    PushSubscription.notifications_enabled == True
                )
            ).offset(skip).limit(limit)
        )
        return result.scalars().all()
    
    async def get_by_notification_type(self, db: AsyncSession, notification_type: str, skip: int = 0, limit: int = 100) -> List[PushSubscription]:
        """Получить подписки, которые хотят получать определенный тип уведомлений"""
        # Временно упрощаем - получаем все активные подписки
        # TODO: добавить фильтрацию по типам уведомлений после исправления схемы БД
        result = await db.execute(
            select(PushSubscription).filter(
                and_(
                    PushSubscription.is_active == True,
                    PushSubscription.notifications_enabled == True
                )
            ).offset(skip).limit(limit)
        )
        return result.scalars().all()
    
    async def get_multi(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[PushSubscription]:
        """Получить все подписки"""
        result = await db.execute(select(PushSubscription).offset(skip).limit(limit))
        return result.scalars().all()
    
    async def get_inactive(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[PushSubscription]:
        """Получить все неактивные подписки"""
        result = await db.execute(
            select(PushSubscription).filter(
                PushSubscription.is_active == False
            ).offset(skip).limit(limit)
        )
        return result.scalars().all()
    
    async def update(self, db: AsyncSession, *, db_obj: PushSubscription, obj_in: PushSubscriptionUpdate) -> PushSubscription:
        """Обновить подписку"""
        update_data = obj_in.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def update_last_notification(self, db: AsyncSession, subscription_id: int) -> bool:
        """Обновить время последнего уведомления"""
        result = await db.execute(
            select(PushSubscription).filter(PushSubscription.id == subscription_id)
        )
        subscription = result.scalar_one_or_none()
        if subscription:
            subscription.last_notification_sent = datetime.utcnow()
            await db.commit()
            return True
        return False
    
    async def deactivate(self, db: AsyncSession, *, subscription_id: int) -> bool:
        """Деактивировать подписку (при ошибках отправки)"""
        result = await db.execute(
            select(PushSubscription).filter(PushSubscription.id == subscription_id)
        )
        subscription = result.scalar_one_or_none()
        if subscription:
            subscription.is_active = False
            await db.commit()
            return True
        return False
    
    async def delete(self, db: AsyncSession, *, id: int) -> Optional[PushSubscription]:
        """Удалить подписку"""
        result = await db.execute(select(PushSubscription).filter(PushSubscription.id == id))
        obj = result.scalar_one_or_none()
        if obj:
            await db.delete(obj)
            await db.commit()
        return obj
    
    async def cleanup_old_subscriptions(self, db: AsyncSession, days_old: int = 30) -> int:
        """Очистить старые неактивные подписки"""
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        result = await db.execute(
            select(PushSubscription).filter(
                and_(
                    PushSubscription.is_active == False,
                    PushSubscription.updated_at < cutoff_date
                )
            )
        )
        old_subscriptions = result.scalars().all()
        
        for subscription in old_subscriptions:
            await db.delete(subscription)
        
        await db.commit()
        return len(old_subscriptions)
    
    async def get_statistics(self, db: AsyncSession) -> Dict[str, Any]:
        """Получить статистику по подпискам"""
        # Общее количество
        total_result = await db.execute(select(PushSubscription))
        total = len(total_result.scalars().all())
        
        # Активные
        active_result = await db.execute(
            select(PushSubscription).filter(PushSubscription.is_active == True)
        )
        active = len(active_result.scalars().all())
        
        # С включенными уведомлениями
        enabled_result = await db.execute(
            select(PushSubscription).filter(
                and_(
                    PushSubscription.is_active == True,
                    PushSubscription.notifications_enabled == True
                )
            )
        )
        enabled = len(enabled_result.scalars().all())
        
        return {
            "total_subscriptions": total,
            "active_subscriptions": active,
            "enabled_subscriptions": enabled,
            "disabled_subscriptions": total - enabled
        }

# Создаем экземпляр для использования
crud_push_subscription = CRUDPushSubscription() 