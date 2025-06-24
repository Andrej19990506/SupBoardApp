from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from db.session import get_db_session
from crud.push_subscription import crud_push_subscription
from schemas.push_subscription import (
    PushSubscriptionCreate,
    PushSubscriptionUpdate,
    PushSubscriptionResponse,
    NotificationPayload,
    SendNotificationRequest,
    SendBookingNotificationRequest,
    NotificationResult
)
from services.push_notification_service import get_push_notification_service
from core.config import get_settings
from services.push_notification_service import PushNotificationService

router = APIRouter()

# Инициализируем сервис push уведомлений
push_service = PushNotificationService()


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Получить публичный VAPID ключ для настройки клиента"""
    # Получаем ключ в формате base64url для Web Push API
    web_push_key = push_service.get_vapid_public_key_for_web_push()
    if not web_push_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notification service не настроен"
        )
    
    return {
        "public_key": web_push_key,
        "application_server_key": web_push_key  # Для совместимости
    }


@router.post("/subscriptions", response_model=PushSubscriptionResponse)
async def create_subscription(
    request: Request,
    subscription_data: PushSubscriptionCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """Создать новую push подписку или обновить существующую"""
    try:
        # Логируем raw JSON
        body = await request.body()
        logger.info(f"Raw request body: {body.decode('utf-8')}")
        
        logger.info(f"Получены данные подписки: {subscription_data}")
        logger.info(f"Endpoint: {subscription_data.endpoint}")
        logger.info(f"Keys: {subscription_data.keys}")
        logger.info(f"User Agent: {subscription_data.user_agent}")
        logger.info(f"Notification Types: {subscription_data.notification_types}")
        
        # Сначала проверим, существует ли подписка с таким endpoint
        existing_subscription = await crud_push_subscription.get_by_endpoint(db, endpoint=subscription_data.endpoint)
        
        if existing_subscription:
            logger.info(f"Найдена существующая подписка: {existing_subscription.id}, обновляем её")
            # Обновляем существующую подписку
            update_data = PushSubscriptionUpdate(
                p256dh=subscription_data.keys.p256dh,
                auth=subscription_data.keys.auth,
                user_agent=subscription_data.user_agent,
                notification_types=subscription_data.notification_types,
                is_active=True,
                notifications_enabled=True
            )
            subscription = await crud_push_subscription.update(db, db_obj=existing_subscription, obj_in=update_data)
            logger.info(f"Обновлена push подписка: {subscription.id}")
        else:
            # Создаем новую подписку
            subscription = await crud_push_subscription.create(db, obj_in=subscription_data)
            logger.info(f"Создана новая push подписка: {subscription.id}")
        
        return subscription
    except Exception as e:
        logger.error(f"Ошибка создания/обновления push подписки: {e}")
        logger.error(f"Тип ошибки: {type(e)}")
        import traceback
        logger.error(f"Трассировка: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось создать или обновить подписку"
        )


@router.get("/subscriptions", response_model=List[PushSubscriptionResponse])
async def get_subscriptions(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    notification_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session)
):
    """Получить список push подписок"""
    if notification_type:
        subscriptions = await crud_push_subscription.get_by_notification_type(
            db, notification_type=notification_type, skip=skip, limit=limit
        )
    elif is_active is not None:
        if is_active:
            subscriptions = await crud_push_subscription.get_active(db, skip=skip, limit=limit)
        else:
            subscriptions = await crud_push_subscription.get_inactive(db, skip=skip, limit=limit)
    else:
        subscriptions = await crud_push_subscription.get_multi(db, skip=skip, limit=limit)
    
    return subscriptions


@router.get("/subscriptions/{subscription_id}", response_model=PushSubscriptionResponse)
async def get_subscription(
    subscription_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """Получить конкретную push подписку"""
    subscription = await crud_push_subscription.get(db, id=subscription_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Подписка не найдена"
        )
    return subscription


@router.patch("/subscriptions/{subscription_id}", response_model=PushSubscriptionResponse)
async def update_subscription(
    subscription_id: int,
    subscription_update: PushSubscriptionUpdate,
    db: AsyncSession = Depends(get_db_session)
):
    """Обновить push подписку"""
    subscription = await crud_push_subscription.get(db, id=subscription_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Подписка не найдена"
        )
    
    updated_subscription = await crud_push_subscription.update(
        db, db_obj=subscription, obj_in=subscription_update
    )
    return updated_subscription


@router.delete("/subscriptions/{subscription_id}")
async def delete_subscription(
    subscription_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """Удалить push подписку"""
    subscription = await crud_push_subscription.get(db, id=subscription_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Подписка не найдена"
        )
    
    await crud_push_subscription.delete(db, id=subscription_id)
    return {"message": "Подписка удалена"}


@router.post("/send")
async def send_notification(
    request: SendNotificationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
):
    """Отправить push уведомление"""
    push_service = get_push_notification_service()
    if not push_service.is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notification service не настроен"
        )
    
    # Получаем подписки
    if request.subscription_ids:
        subscriptions = []
        for sub_id in request.subscription_ids:
            subscription = await crud_push_subscription.get(db, id=sub_id)
            if subscription and subscription.is_valid():
                subscriptions.append(subscription)
    elif request.notification_type:
        subscriptions = await crud_push_subscription.get_by_notification_type(
            db, notification_type=request.notification_type
        )
    else:
        subscriptions = await crud_push_subscription.get_active(db, limit=1000)
    
    if not subscriptions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Не найдено активных подписок"
        )
    
    # Отправляем уведомления в фоне
    async def send_notifications_task():
        try:
            result = await push_service.send_bulk_notifications(
                subscriptions=subscriptions,
                payload=request.payload,
                max_concurrent=request.max_concurrent or 10
            )
            
            # Деактивируем недействительные подписки
            if result["invalid_subscriptions"]:
                for sub_id in result["invalid_subscriptions"]:
                    await crud_push_subscription.deactivate(db, subscription_id=sub_id)
            
            logger.info(f"Отправка завершена: {result}")
            
        except Exception as e:
            logger.error(f"Ошибка при отправке уведомлений: {e}")
    
    background_tasks.add_task(send_notifications_task)
    
    return {
        "message": "Уведомления отправляются в фоне",
        "target_subscriptions": len(subscriptions)
    }


@router.post("/send-booking-notification")
async def send_booking_notification(
    request: SendBookingNotificationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
):
    """Отправить уведомление о бронировании"""
    push_service = get_push_notification_service()
    if not push_service.is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notification service не настроен"
        )
    
    try:
        # Создаем payload для уведомления
        payload = push_service.create_booking_notification(
            booking_id=request.booking_id,
            client_name=request.client_name,
            notification_type=request.notification_type,
            additional_data=request.additional_data or {}
        )
        
        # Получаем активные подписки для уведомлений о бронированиях
        subscriptions = await crud_push_subscription.get_by_notification_type(
            db, notification_type="booking_updates"
        )
        
        if not subscriptions:
            return {"message": "Нет активных подписок для уведомлений о бронированиях"}
        
        # Отправляем уведомления в фоне
        async def send_booking_notifications_task():
            try:
                result = await push_service.send_bulk_notifications(
                    subscriptions=subscriptions,
                    payload=payload,
                    max_concurrent=10
                )
                
                # Деактивируем недействительные подписки
                if result["invalid_subscriptions"]:
                    for sub_id in result["invalid_subscriptions"]:
                        await crud_push_subscription.deactivate(db, subscription_id=sub_id)
                
                logger.info(f"Уведомления о бронировании отправлены: {result}")
                
            except Exception as e:
                logger.error(f"Ошибка при отправке уведомлений о бронировании: {e}")
        
        background_tasks.add_task(send_booking_notifications_task)
        
        return {
            "message": f"Уведомление '{request.notification_type}' отправляется",
            "booking_id": request.booking_id,
            "target_subscriptions": len(subscriptions)
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/subscriptions/stats")
async def get_subscription_stats(db: AsyncSession = Depends(get_db_session)):
    """Получить статистику подписок"""
    stats = await crud_push_subscription.get_stats(db)
    return stats


@router.post("/subscriptions/cleanup")
async def cleanup_subscriptions(
    days_inactive: int = 30,
    db: AsyncSession = Depends(get_db_session)
):
    """Очистить неактивные подписки"""
    try:
        removed_count = await crud_push_subscription.cleanup_inactive(db, days=days_inactive)
        return {
            "message": f"Удалено {removed_count} неактивных подписок",
            "days_inactive": days_inactive
        }
    except Exception as e:
        logger.error(f"Ошибка при очистке подписок: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при очистке подписок"
        )


@router.get("/debug-config")
async def debug_config():
    """Debug endpoint для проверки конфигурации VAPID ключей"""
    settings = get_settings()
    push_service = get_push_notification_service()
    
    # Проверяем статус нашего сервиса (не создаем новый WebPush)
    webpush_status = "success" if push_service.is_available() else "error"
    webpush_error = None if push_service.is_available() else "Service not initialized"
    
    return {
        "vapid_private_key_length": len(settings.VAPID_PRIVATE_KEY) if settings.VAPID_PRIVATE_KEY else 0,
        "vapid_public_key_length": len(settings.VAPID_PUBLIC_KEY) if settings.VAPID_PUBLIC_KEY else 0,
        "vapid_private_key_starts_with": settings.VAPID_PRIVATE_KEY[:50] if settings.VAPID_PRIVATE_KEY else "",
        "vapid_public_key_starts_with": settings.VAPID_PUBLIC_KEY[:50] if settings.VAPID_PUBLIC_KEY else "",
        "vapid_claims_sub": settings.VAPID_CLAIMS_SUB,
        "service_available": push_service.is_available(),
        "webpush_initialization": {
            "status": webpush_status,
            "error": webpush_error
        }
    }


@router.get("/test")
async def test_push_service():
    """Проверяет статус сервиса push уведомлений"""
    push_service = get_push_notification_service()
    if push_service.is_available():
        return {
            "status": "available",
            "message": "Push notification service настроен и готов к работе"
        }
    else:
        return {
            "status": "unavailable", 
            "message": "Push notification service не настроен"
        } 