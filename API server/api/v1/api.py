# backend/API server/api/v1/api.py
from fastapi import APIRouter
from .endpoints import booking, push_notification, inventory, auth, user, customer

api_router = APIRouter()

# Авторизация
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Новые модели бизнес-логики
api_router.include_router(user.router, prefix="/users", tags=["users"])
api_router.include_router(customer.router, prefix="/customers", tags=["customers"])

# Новый гибкий инвентарь
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])

# Основные роутеры
api_router.include_router(booking.router, prefix="/bookings", tags=["bookings"])
api_router.include_router(push_notification.router, prefix="/push-notifications", tags=["push-notifications"])

# Удален конфликтующий корневой endpoint - используется endpoint в main.py

