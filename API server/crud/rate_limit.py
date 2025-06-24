from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, or_
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

from models.security import RateLimitEntry


class CRUDRateLimit:
    """CRUD операции для rate limiting"""

    async def check_rate_limit(
        self,
        db: AsyncSession,
        *,
        limit_key: str,
        limit_type: str,
        max_requests: int,
        window_minutes: int
    ) -> Dict[str, Any]:
        """
        Проверяет и обновляет rate limit
        Возвращает информацию о лимите и разрешении
        """
        window_start = datetime.utcnow() - timedelta(minutes=window_minutes)
        
        # Ищем существующую запись в текущем окне
        result = await db.execute(
            select(RateLimitEntry).where(
                and_(
                    RateLimitEntry.limit_key == limit_key,
                    RateLimitEntry.limit_type == limit_type,
                    RateLimitEntry.window_start >= window_start
                )
            )
        )
        entry = result.scalar_one_or_none()
        
        if entry:
            # Обновляем существующую запись
            entry.requests_count += 1
            entry.last_request_at = datetime.utcnow()
            
            # Проверяем лимит
            is_allowed = entry.requests_count <= max_requests
            remaining = max(0, max_requests - entry.requests_count)
            
            await db.commit()
            
            return {
                "allowed": is_allowed,
                "requests_count": entry.requests_count,
                "max_requests": max_requests,
                "remaining": remaining,
                "window_start": entry.window_start,
                "reset_at": entry.window_start + timedelta(minutes=window_minutes)
            }
        else:
            # Создаем новую запись
            new_entry = RateLimitEntry(
                limit_key=limit_key,
                limit_type=limit_type,
                requests_count=1,
                window_start=datetime.utcnow(),
                last_request_at=datetime.utcnow()
            )
            db.add(new_entry)
            await db.commit()
            
            return {
                "allowed": True,
                "requests_count": 1,
                "max_requests": max_requests,
                "remaining": max_requests - 1,
                "window_start": new_entry.window_start,
                "reset_at": new_entry.window_start + timedelta(minutes=window_minutes)
            }

    async def get_rate_limit_info(
        self,
        db: AsyncSession,
        *,
        limit_key: str,
        limit_type: str,
        window_minutes: int
    ) -> Optional[Dict[str, Any]]:
        """Получает информацию о текущем лимите без изменения счетчика"""
        window_start = datetime.utcnow() - timedelta(minutes=window_minutes)
        
        result = await db.execute(
            select(RateLimitEntry).where(
                and_(
                    RateLimitEntry.limit_key == limit_key,
                    RateLimitEntry.limit_type == limit_type,
                    RateLimitEntry.window_start >= window_start
                )
            )
        )
        entry = result.scalar_one_or_none()
        
        if entry:
            return {
                "requests_count": entry.requests_count,
                "window_start": entry.window_start,
                "last_request_at": entry.last_request_at,
                "reset_at": entry.window_start + timedelta(minutes=window_minutes)
            }
        
        return None

    async def reset_rate_limit(
        self,
        db: AsyncSession,
        *,
        limit_key: str,
        limit_type: str
    ) -> bool:
        """Сбрасывает rate limit для указанного ключа"""
        result = await db.execute(
            select(RateLimitEntry).where(
                and_(
                    RateLimitEntry.limit_key == limit_key,
                    RateLimitEntry.limit_type == limit_type
                )
            )
        )
        entry = result.scalar_one_or_none()
        
        if entry:
            await db.delete(entry)
            await db.commit()
            return True
        
        return False

    async def cleanup_expired_entries(
        self,
        db: AsyncSession,
        older_than_hours: int = 24
    ) -> int:
        """Удаляет устаревшие записи rate limit"""
        cutoff_time = datetime.utcnow() - timedelta(hours=older_than_hours)
        
        result = await db.execute(
            select(RateLimitEntry).where(
                RateLimitEntry.window_start < cutoff_time
            )
        )
        expired_entries = result.scalars().all()
        
        for entry in expired_entries:
            await db.delete(entry)
        
        await db.commit()
        return len(expired_entries)

    def generate_sms_limit_key(self, phone: str) -> str:
        """Генерирует ключ для SMS лимита"""
        return f"sms:{phone}"

    def generate_api_limit_key(self, ip_address: str) -> str:
        """Генерирует ключ для API лимита"""
        return f"api:{ip_address}"

    def generate_login_limit_key(self, ip_address: str, phone: Optional[str] = None) -> str:
        """Генерирует ключ для лимита входа"""
        if phone:
            return f"login:{ip_address}:{phone}"
        return f"login:{ip_address}"


# Создаем глобальный экземпляр CRUD
rate_limit_crud = CRUDRateLimit() 