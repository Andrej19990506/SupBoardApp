from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import hashlib
import secrets

from models.security import DeviceSession


class CRUDDeviceSession:
    """CRUD операции для сессий устройств"""

    async def create_session(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        device_fingerprint: str,
        refresh_token: str,
        ip_address: str,
        user_agent: Optional[str] = None,
        expires_hours: int = 168  # 7 дней по умолчанию
    ) -> DeviceSession:
        """Создает новую сессию устройства"""
        
        # Хешируем refresh token для безопасного хранения
        refresh_token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        
        # Вычисляем время истечения
        expires_at = datetime.utcnow() + timedelta(hours=expires_hours)
        
        # Парсим информацию о браузере и ОС (простая версия)
        browser_name, os_name, device_type = self._parse_user_agent(user_agent)
        
        db_obj = DeviceSession(
            user_id=user_id,
            device_fingerprint=device_fingerprint,
            refresh_token_hash=refresh_token_hash,
            ip_address=ip_address,
            user_agent=user_agent,
            browser_name=browser_name,
            os_name=os_name,
            device_type=device_type,
            expires_at=expires_at,
            is_active=True
        )
        
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get_session_by_refresh_token(
        self,
        db: AsyncSession,
        refresh_token: str
    ) -> Optional[DeviceSession]:
        """Получает сессию по refresh token"""
        refresh_token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        
        result = await db.execute(
            select(DeviceSession).where(
                and_(
                    DeviceSession.refresh_token_hash == refresh_token_hash,
                    DeviceSession.expires_at > datetime.utcnow()
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_active_sessions_for_user(
        self,
        db: AsyncSession,
        user_id: int
    ) -> List[DeviceSession]:
        """Получает все активные сессии пользователя"""
        result = await db.execute(
            select(DeviceSession).where(
                and_(
                    DeviceSession.user_id == user_id,
                    DeviceSession.expires_at > datetime.utcnow()
                )
            ).order_by(DeviceSession.last_used_at.desc())
        )
        return result.scalars().all()

    async def update_last_used(
        self,
        db: AsyncSession,
        session_id: int,
        ip_address: Optional[str] = None
    ) -> Optional[DeviceSession]:
        """Обновляет время последнего использования сессии"""
        result = await db.execute(
            select(DeviceSession).where(DeviceSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            session.last_used_at = datetime.utcnow()
            if ip_address:
                session.ip_address = ip_address
            await db.commit()
            await db.refresh(session)
        
        return session

    async def update_refresh_token(
        self,
        db: AsyncSession,
        session_id: int,
        new_refresh_token: str
    ) -> Optional[DeviceSession]:
        """Обновляет refresh token для существующей сессии"""
        result = await db.execute(
            select(DeviceSession).where(DeviceSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            # Хешируем новый refresh token
            new_refresh_token_hash = hashlib.sha256(new_refresh_token.encode()).hexdigest()
            session.refresh_token_hash = new_refresh_token_hash
            session.last_used_at = datetime.utcnow()
            await db.commit()
            await db.refresh(session)
        
        return session

    async def revoke_session(
        self,
        db: AsyncSession,
        session_id: int
    ) -> bool:
        """Удаляет сессию из базы данных"""
        result = await db.execute(
            select(DeviceSession).where(DeviceSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            await db.delete(session)
            await db.commit()
            return True
        
        return False

    async def revoke_all_sessions_for_user(
        self,
        db: AsyncSession,
        user_id: int,
        except_session_id: Optional[int] = None
    ) -> int:
        """Удаляет все сессии пользователя из базы данных, кроме указанной"""
        query = select(DeviceSession).where(
            DeviceSession.user_id == user_id
        )
        
        if except_session_id:
            query = query.where(DeviceSession.id != except_session_id)
        
        result = await db.execute(query)
        sessions = result.scalars().all()
        
        deleted_count = 0
        for session in sessions:
            await db.delete(session)
            deleted_count += 1
        
        await db.commit()
        return deleted_count

    async def cleanup_expired_sessions(self, db: AsyncSession) -> int:
        """Удаляет истекшие сессии"""
        result = await db.execute(
            select(DeviceSession).where(
                DeviceSession.expires_at < datetime.utcnow()
            )
        )
        expired_sessions = result.scalars().all()
        
        for session in expired_sessions:
            await db.delete(session)
        
        await db.commit()
        return len(expired_sessions)

    def _parse_user_agent(self, user_agent: Optional[str]) -> tuple:
        """Парсит user agent для извлечения информации о браузере и ОС"""
        if not user_agent:
            return None, None, None
        
        # Простой парсинг - можно улучшить с помощью библиотеки user-agents
        browser_name = "Unknown"
        os_name = "Unknown" 
        device_type = "Unknown"
        
        # Определяем браузер
        if "Chrome" in user_agent:
            browser_name = "Chrome"
        elif "Firefox" in user_agent:
            browser_name = "Firefox"
        elif "Safari" in user_agent and "Chrome" not in user_agent:
            browser_name = "Safari"
        elif "Edge" in user_agent:
            browser_name = "Edge"
        
        # Определяем ОС
        if "Windows" in user_agent:
            os_name = "Windows"
        elif "Macintosh" in user_agent or "Mac OS" in user_agent:
            os_name = "macOS"
        elif "Linux" in user_agent:
            os_name = "Linux"
        elif "Android" in user_agent:
            os_name = "Android"
        elif "iPhone" in user_agent or "iPad" in user_agent:
            os_name = "iOS"
        
        # Определяем тип устройства
        if "Mobile" in user_agent or "Android" in user_agent:
            device_type = "Mobile"
        elif "Tablet" in user_agent or "iPad" in user_agent:
            device_type = "Tablet"
        else:
            device_type = "Desktop"
        
        return browser_name, os_name, device_type

    def generate_device_fingerprint(
        self,
        ip_address: str,
        user_agent: Optional[str],
        additional_data: Optional[Dict[str, Any]] = None
    ) -> str:
        """Генерирует отпечаток устройства"""
        fingerprint_data = f"{ip_address}:{user_agent or ''}"
        
        if additional_data:
            for key, value in sorted(additional_data.items()):
                fingerprint_data += f":{key}={value}"
        
        return hashlib.sha256(fingerprint_data.encode()).hexdigest()

    async def get_sessions_by_fingerprint(
        self,
        db: AsyncSession,
        device_fingerprint: str,
        include_inactive: bool = False
    ) -> List[DeviceSession]:
        """Находит все сессии с указанным device fingerprint"""
        query = select(DeviceSession).where(DeviceSession.device_fingerprint == device_fingerprint)
        
        if not include_inactive:
            query = query.where(DeviceSession.is_active == True)
            
        query = query.order_by(DeviceSession.created_at.desc())
        
        result = await db.execute(query)
        return result.scalars().all()


# Создаем глобальный экземпляр CRUD
device_session_crud = CRUDDeviceSession() 