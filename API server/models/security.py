"""
Модели безопасности для системы аутентификации
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from datetime import datetime
from .base import Base


class DeviceSession(Base):
    """Модель для отслеживания сессий устройств"""
    __tablename__ = "device_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    device_fingerprint = Column(String(255), nullable=False, index=True)
    refresh_token_hash = Column(String(255), nullable=False, unique=True)
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(Text, nullable=True)
    browser_name = Column(String(100), nullable=True)
    os_name = Column(String(100), nullable=True)
    device_type = Column(String(50), nullable=True)
    country = Column(String(2), nullable=True)
    city = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return (
            f"<DeviceSession(id={self.id}, user_id={self.user_id}, "
            f"device_type='{self.device_type}', is_active={self.is_active})>"
        )

    def to_dict(self):
        """Преобразует в словарь для API ответов"""
        return {
            "id": self.id,
            "device_fingerprint": self.device_fingerprint[:16] + "...",  # Обрезаем для безопасности
            "ip_address": self.ip_address,
            "browser_name": self.browser_name,
            "os_name": self.os_name,
            "device_type": self.device_type,
            "country": self.country,
            "city": self.city,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None
        }


class RateLimitEntry(Base):
    """Модель для отслеживания лимитов запросов"""
    __tablename__ = "rate_limit_entries"

    id = Column(Integer, primary_key=True, index=True)
    limit_key = Column(String(100), nullable=False, index=True)  # IP, phone, user_id
    limit_type = Column(String(20), nullable=False, index=True)  # sms, api, login
    requests_count = Column(Integer, default=1, nullable=False)
    window_start = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_request_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return (
            f"<RateLimitEntry(id={self.id}, limit_key='{self.limit_key}', "
            f"limit_type='{self.limit_type}', requests_count={self.requests_count})>"
        )


class BlockedIP(Base):
    """Модель для заблокированных IP адресов"""
    __tablename__ = "blocked_ips"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String(45), nullable=False, unique=True, index=True)
    reason = Column(String(255), nullable=False)
    violation_count = Column(Integer, default=1, nullable=False)
    blocked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    user_agent = Column(Text, nullable=True)
    country = Column(String(2), nullable=True)
    notes = Column(Text, nullable=True)

    def __repr__(self):
        return (
            f"<BlockedIP(id={self.id}, ip_address='{self.ip_address}', "
            f"reason='{self.reason}', is_active={self.is_active})>"
        )

    def is_expired(self) -> bool:
        """Проверяет, истек ли срок блокировки"""
        return datetime.utcnow() > self.expires_at

    def to_dict(self):
        """Преобразует в словарь для API ответов"""
        return {
            "id": self.id,
            "ip_address": self.ip_address,
            "reason": self.reason,
            "violation_count": self.violation_count,
            "blocked_at": self.blocked_at.isoformat() if self.blocked_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active,
            "country": self.country,
            "is_expired": self.is_expired()
        }


class SecurityLog(Base):
    """Модель для логирования событий безопасности"""
    __tablename__ = "security_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)  # login, logout, failed_login, suspicious_activity
    severity = Column(String(20), nullable=False, index=True)   # low, medium, high, critical
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    ip_address = Column(String(45), nullable=False, index=True)
    user_agent = Column(Text, nullable=True)
    device_fingerprint = Column(String(255), nullable=True)
    description = Column(String(500), nullable=False)
    additional_data = Column(Text, nullable=True)  # JSON данные
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    def __repr__(self):
        return (
            f"<SecurityLog(id={self.id}, event_type='{self.event_type}', "
            f"severity='{self.severity}', client_id={self.client_id})>"
        )

    def to_dict(self):
        """Преобразует в словарь для API ответов"""
        return {
            "id": self.id,
            "event_type": self.event_type,
            "severity": self.severity,
            "client_id": self.client_id,
            "ip_address": self.ip_address,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None
        } 