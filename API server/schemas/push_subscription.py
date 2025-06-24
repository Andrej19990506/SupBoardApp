from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, List, Any, Union
from datetime import datetime

class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(..., description="Публичный ключ клиента")
    auth: str = Field(..., description="Ключ аутентификации")

class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(..., description="Endpoint для push-уведомлений")
    keys: PushSubscriptionKeys
    user_agent: Optional[str] = Field(None, description="User Agent браузера")
    notification_types: Optional[List[str]] = Field(
        default=["booking_updates"],
        description="Типы уведомлений для подписки"
    )
    
    @validator('endpoint')
    def validate_endpoint(cls, v):
        if not v.startswith('https://'):
            raise ValueError('Endpoint должен начинаться с https://')
        return v

class PushSubscriptionUpdate(BaseModel):
    notifications_enabled: Optional[bool] = None
    notification_types: Optional[List[str]] = None

class PushSubscriptionResponse(BaseModel):
    id: int
    endpoint: str
    is_active: bool
    notifications_enabled: bool
    notification_types: Optional[List[str]]
    created_at: datetime
    updated_at: datetime
    last_notification_sent: Optional[datetime]
    
    class Config:
        from_attributes = True

class NotificationAction(BaseModel):
    """Действие в push-уведомлении"""
    action: str = Field(..., description="Идентификатор действия")
    title: str = Field(..., description="Текст кнопки действия")
    icon: Optional[str] = Field(None, description="URL иконки действия")

class NotificationPayload(BaseModel):
    title: str = Field(..., description="Заголовок уведомления")
    body: str = Field(..., description="Текст уведомления")
    icon: Optional[str] = Field(None, description="URL иконки уведомления")
    badge: Optional[str] = Field(None, description="URL значка уведомления")
    tag: Optional[str] = Field(None, description="Тег для группировки уведомлений")
    requireInteraction: Optional[bool] = Field(False, description="Требует взаимодействия пользователя")
    actions: Optional[List[NotificationAction]] = Field(None, description="Действия в уведомлении")
    data: Dict[str, Any] = Field(default_factory=dict, description="Дополнительные данные")

class SendNotificationRequest(BaseModel):
    payload: NotificationPayload
    subscription_ids: Optional[List[int]] = Field(None, description="ID подписок (если не указано - всем активным)")
    notification_type: Optional[str] = Field(None, description="Тип уведомления для фильтрации")
    max_concurrent: Optional[int] = Field(10, description="Максимальное количество одновременных отправок")

class NotificationResult(BaseModel):
    success: bool
    error: Optional[str] = None
    should_remove: bool = False 

class SendBookingNotificationRequest(BaseModel):
    booking_id: int = Field(..., description="ID бронирования")
    client_name: str = Field(..., description="Имя клиента")
    notification_type: str = Field(..., description="Тип уведомления")
    additional_data: Optional[Dict[str, Any]] = Field(None, description="Дополнительные данные") 