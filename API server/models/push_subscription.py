from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON
from sqlalchemy.sql import func
from datetime import datetime
from .base import Base

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    
    # Данные подписки
    endpoint = Column(String(512), nullable=False, unique=True, index=True)
    p256dh = Column(String(256), nullable=False)  # Публичный ключ клиента
    auth = Column(String(256), nullable=False)    # Ключ аутентификации
    
    # Метаданные
    user_agent = Column(String(512), nullable=True)  # Браузер пользователя
    ip_address = Column(String(45), nullable=True)   # IP адрес
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Настройки уведомлений
    notifications_enabled = Column(Boolean, nullable=False, default=True)
    notification_types = Column(JSON, nullable=True)  # Какие типы уведомлений включены
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_notification_sent = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<PushSubscription(id={self.id}, endpoint='{self.endpoint[:50]}...', active={self.is_active})>"
    
    def to_dict(self):
        """Преобразует подписку в формат для отправки push-уведомлений"""
        return {
            'endpoint': self.endpoint,
            'keys': {
                'p256dh': self.p256dh,
                'auth': self.auth
            }
        }
    
    def is_valid(self) -> bool:
        """Проверяет валидность подписки"""
        return (
            self.is_active and 
            self.notifications_enabled and 
            self.endpoint and 
            self.p256dh and 
            self.auth
        )