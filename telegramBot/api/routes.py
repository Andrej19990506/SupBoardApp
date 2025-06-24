import logging
import json
import os
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict
import time
import telegram
from telegram.error import BadRequest
import random

# Импортируем типы Telegram и Application
from telegram import Update, InputFile
from telegram.ext import Application
from telegram.constants import ParseMode
from telegram.ext import ContextTypes, CallbackQueryHandler

# Импортируем httpx и get_async_http_client
import httpx

# Импортируем модель Pydantic
from .models import SendMessagePayload

# Импортируем конфигурацию (для пути вебхука и секрета)
from config.config import Config
from api.models import RefreshUserPayload
# Инициализируем логгер для этого модуля
logger = logging.getLogger(__name__)

# Определяем базовую директорию для файлов табеля (для безопасности)
ALLOWED_FILE_DIR = Path("/app/shared/timesheets")

# ---> ДОБАВЛЕНИЕ: Директория для отчетов инвентаризации < ---
ALLOWED_REPORTS_DIR = Path(os.getenv("SHARED_REPORTS_FOLDER", "/app/shared/inventory_reports"))
# ---> КОНЕЦ ДОБАВЛЕНИЯ < ---


# Создаем APIRouter
router = APIRouter()

# --- Эндпоинт /api/send_message --- 
@router.post("/send_message", tags=["API"])
async def send_message_api_v2(payload: SendMessagePayload, request: Request):
    """Прямой маршрут для отправки сообщений через Telegram бота (FastAPI)"""
    logger.info("📬 Получен FastAPI запрос на /api/send_message")
    logger.info(f"Данные payload: {payload.model_dump()}")
    
    try:
        # Получаем экземпляр бота из app.state
        bot_app: Application = request.app.state.bot_application
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state")
            raise HTTPException(status_code=503, detail="Bot instance not available")
            
        # Преобразуем формат ID чата
        chat_id_str = payload.chat_id
        processed_chat_id: int
        try:
            # Просто преобразуем строку в int, Telegram сам разберется с форматом
            processed_chat_id = int(chat_id_str)
            logger.info(f"ID чата {chat_id_str} обработан как {processed_chat_id}")
        except ValueError:
             logger.error(f"Не удалось преобразовать chat_id '{chat_id_str}' в число")
             raise HTTPException(status_code=400, detail=f"Invalid chat_id format: {chat_id_str}")

        # Отправляем сообщение
        try:
            await bot_app.bot.send_message(
                chat_id=processed_chat_id,
                text=payload.text,
                parse_mode=payload.parse_mode,
                reply_markup=payload.reply_markup if payload.reply_markup else None
            )
            logger.info(f"✅ Сообщение успешно отправлено в чат {chat_id_str}")
            return {"success": True, "message": "Сообщение успешно отправлено"}
        
        except BadRequest as e:
            error_message = str(e)
            logger.warning(f"⚠️ Ошибка BadRequest при первой попытке отправки сообщения в чат {chat_id_str} ({processed_chat_id}): {error_message}")

            if "chat not found" in error_message.lower() and chat_id_str.startswith("-100"):
                try:
                    alternative_chat_id_str = f"-{chat_id_str[4:]}"
                    alternative_chat_id = int(alternative_chat_id_str)
                    logger.info(f"Попытка отправить сообщение в чат {alternative_chat_id_str} (альтернативный ID)")
                    
                    await bot_app.bot.send_message(
                        chat_id=alternative_chat_id,
                        text=payload.text,
                        parse_mode=payload.parse_mode,
                        reply_markup=payload.reply_markup if payload.reply_markup else None
                    )
                    logger.info(f"✅ Сообщение успешно отправлено в чат {alternative_chat_id_str} при второй попытке.")
                    return {"success": True, "message": "Сообщение успешно отправлено (со второй попытки)"}
                
                except Exception as retry_exc:
                    logger.error(f"❌ Ошибка Telegram при ВТОРОЙ попытке отправки сообщения в чат {alternative_chat_id_str}: {retry_exc}")
                    raise HTTPException(status_code=500, detail=f"Failed to send message after retry: {retry_exc}")
            else:
                logger.error(f"❌ Ошибка BadRequest (не chat not found или ID без -100) при отправке сообщения в чат {chat_id_str}: {error_message}")
                raise HTTPException(status_code=500, detail=f"Failed to send message: {error_message}")
        
        except Exception as e:
            logger.error(f"❌ Непредвиденная ошибка при вызове bot.send_message для чата {chat_id_str}: {e}", exc_info=True)
            error_detail = str(e)
            if hasattr(e, 'message'): error_detail = e.message
            raise HTTPException(status_code=500, detail=f"Failed to send message: {error_detail}")
            
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка в /api/send_message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# --- Эндпоинт для проверки доступности отправки сообщений ---
@router.get("/send_message/health", tags=["System"])
async def check_send_message_availability(request: Request):
    """
    Проверяет доступность маршрута /send_message без фактической отправки сообщения в Telegram.
    Используется шедулером для проверки готовности бота к отправке сообщений.
    """
    try:
        # Получаем экземпляр бота из app.state только для проверки, что он доступен
        bot_app: Application = request.app.state.bot_application
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state при проверке health")
            raise HTTPException(status_code=503, detail="Bot instance not available")
            
        # Если бот доступен, возвращаем успешный статус
        logger.info("✅ Проверка доступности маршрута /send_message успешна")
        return {
            "status": "ok",
            "message": "Send message endpoint is available",
            "send_message_url": "/send_message"
        }
            
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка в /send_message/health: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# --- Эндпоинт для вебхука --- 
# Используем значения из Config
c = Config()
WEBHOOK_TELEGRAM_PATH = c.WEBHOOK_PATH if c.WEBHOOK_PATH else "/webhook" # Используем /webhook по умолчанию, если путь не задан
WEBHOOK_SECRET = c.WEBHOOK_SECRET

if not WEBHOOK_TELEGRAM_PATH:
    logger.warning("WEBHOOK_PATH не задан, эндпоинт вебхука не может быть создан динамически в роутере.")
    # Можно либо не создавать роут, либо использовать статический путь
    # raise ValueError("WEBHOOK_PATH не может быть пустым для регистрации эндпоинта вебхука")
    WEBHOOK_TELEGRAM_PATH = "/webhook_fallback_path" # Запасной статический путь

logger.info(f"Регистрация эндпоинта вебхука в роутере по пути: {WEBHOOK_TELEGRAM_PATH}")
@router.post(WEBHOOK_TELEGRAM_PATH, include_in_schema=False) # Скрываем из автодокументации Swagger/OpenAPI
async def telegram_webhook_endpoint(update_data: dict, request: Request):
    """Принимает обновления от Telegram через вебхук."""
    
    # Проверка секретного токена (если используется)
    if WEBHOOK_SECRET:
        secret_token_header = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
        if secret_token_header != WEBHOOK_SECRET:
            logger.warning(f"Неверный секретный токен вебхука: {secret_token_header}")
            raise HTTPException(status_code=403, detail="Invalid secret token")
    
    try:
        bot_app: Application = request.app.state.bot_application
        if not bot_app:
            logger.error("Экземпляр bot_application не найден в app.state")
            raise HTTPException(status_code=503, detail="Bot application not available")
        
        update = Update.de_json(update_data, bot_app.bot)
        logger.info(f"Получено обновление через вебхук: {update.update_id}")
        
        await bot_app.update_queue.put(update)
        
        return {"ok": True}
        
    except json.JSONDecodeError:
        logger.error("Ошибка декодирования JSON в вебхуке")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    except Exception as e:
        logger.error(f"Ошибка при обработке вебхука: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error handling webhook")




# --- НОВЫЙ ЭНДПОИНТ /api/refresh_user --- 
@router.post("/refresh_user", tags=["API"], status_code=status.HTTP_200_OK)
async def refresh_user_data(payload: RefreshUserPayload, request: Request):
    """
    Получает актуальные данные пользователя из Telegram и возвращает их.
    Этот эндпоинт вызывается API сервером для обновления данных пользователя в БД.
    """
    logger.info(f"📬 Получен запрос на /api/refresh_user для пользователя ID {payload.user_id}")
    
    try:
        # Получаем экземпляр бота
        bot_app: Application = request.app.state.bot_application
        if not bot_app or not bot_app.bot:
            logger.error("❌ Экземпляр бота не доступен в app.state при запросе refresh_user")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
                               detail="Bot instance not available")

        # Получаем данные пользователя из Telegram
        try:
            # Пытаемся получить информацию о пользователе через getChatMember
            # Это работает, даже если пользователь не общался с ботом недавно
            # Но требует, чтобы пользователь был членом чата с ботом
            user_id = payload.user_id
            logger.info(f"Получение данных пользователя {user_id} из Telegram")
            
            # Попробуем получить информацию пользователя через getChat
            try:
                chat = await bot_app.bot.get_chat(user_id)
                user_data = {
                    "user_id": chat.id,
                    "first_name": chat.first_name or "",
                    "last_name": chat.last_name or "",
                    "username": chat.username or "",
                    "photo_url": ""  # Получим фото отдельно
                }
                
                # Попытаемся получить фото профиля
                try:
                    photos = await bot_app.bot.get_user_profile_photos(user_id, limit=1)
                    if photos and photos.photos and len(photos.photos) > 0:
                        photo = photos.photos[0][-1]  # Берём лучшее качество из первого фото
                        photo_file = await bot_app.bot.get_file(photo.file_id)
                        user_data["photo_url"] = photo_file.file_path
                except Exception as photo_err:
                    logger.warning(f"⚠️ Не удалось получить фото пользователя {user_id}: {photo_err}")
                    # Игнорируем эту ошибку, просто оставляем photo_url пустым
                
                logger.info(f"✅ Данные пользователя {user_id} успешно получены")
                return user_data
                
            except Exception as chat_err:
                logger.warning(f"⚠️ Не удалось получить данные через getChat: {chat_err}")
                # Попробуем другой подход - через getChatMember, но для этого
                # нужно знать ID чата, где пользователь состоит вместе с ботом
                
                # Здесь можно добавить код для получения данных через getChatMember,
                # если у вас есть доступ к чатам, где состоит пользователь
                
                # Если все методы не сработали:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User information cannot be retrieved from Telegram: {chat_err}"
                )
                
        except HTTPException as http_exc:
            raise http_exc
        except Exception as e:
            logger.error(f"❌ Ошибка при получении данных пользователя {payload.user_id}: {e}", 
                         exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error retrieving user data from Telegram: {e}"
            )
            
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"❌ Непредвиденная ошибка в /api/refresh_user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {e}"
        ) 


