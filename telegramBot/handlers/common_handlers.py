import logging
import json
import traceback
import os
# import aiohttp # Убедитесь, что aiohttp установлен, если используете handle_deletion_callback
from telegram import Update, Bot, MenuButton, MenuButtonWebApp, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from config.config import Config
# Предполагаем, что json_service и deletion_requests будут доступны через context.application.state
# Если нет, их нужно будет передавать иначе или импортировать (менее предпочтительно)

logger = logging.getLogger(__name__)

async def handle_webapp_data(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик данных от веб-приложения"""
    try:
        # Проверяем наличие сообщения
        if not update.effective_message:
            logger.warning("Нет effective_message в обновлении")
            return

        # Проверяем наличие web_app_data
        if not hasattr(update.effective_message, 'web_app_data') or not update.effective_message.web_app_data:
            # logger.warning("Нет web_app_data в сообщении") # Часто срабатывает, можно убрать лог
            return

        # Проверяем наличие данных
        data_str = update.effective_message.web_app_data.data
        if not data_str:
            logger.warning("Пустые данные в web_app_data")
            return

        logger.info(f"Получены сырые данные от WebApp: {data_str}")

        try:
            data = json.loads(data_str)
            logger.info(f"Распарсенные данные WebApp: {data}")

            if data.get('action') == 'open_user_profile':
                user_id = data.get('user_id')
                first_name = data.get('first_name', 'Пользователь')
                logger.info(f"Попытка открыть профиль пользователя {first_name} (ID: {user_id}) через WebApp")

                if user_id:
                    # Создаем клавиатуру с кнопкой
                    keyboard = InlineKeyboardMarkup([
                        [InlineKeyboardButton(
                            text=f"Открыть чат с {first_name}",
                            url=f"tg://user?id={user_id}"
                        )]
                    ])

                    # Отправляем сообщение с кнопкой
                    await update.effective_message.reply_text(
                        f"Нажмите на кнопку ниже, чтобы открыть чат с {first_name}:",
                        reply_markup=keyboard
                    )
                    logger.info("Сообщение WebApp с кнопкой успешно отправлено")
                else:
                    logger.error("Не указан user_id в данных WebApp")
            # Добавьте здесь обработку других 'action' из вашего WebApp, если нужно
            else:
                logger.warning(f"Неизвестное действие WebApp: {data.get('action')}")
        except json.JSONDecodeError as e:
            logger.error(f"Ошибка парсинга JSON от WebApp: {e}")
            return

    except Exception as e:
        logger.error(f"Ошибка при обработке данных веб-приложения: {e}", exc_info=True)


async def handle_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик команды /start"""
    try:
        user = update.effective_user
        logger.info(f"Пользователь {user.full_name} ({user.id}) запустил команду /start")

        # Отправляем приветственное сообщение
        await update.message.reply_text(
            f"Привет, {user.first_name}! 👋"
        )
        logger.info(f"Отправлено приветствие пользователю {user.id}")

        # --- Убрали логику WebApp и кнопки меню ---

    except Exception as e:
        logger.error(f"Ошибка при обработке команды /start: {str(e)}")
        logger.error(traceback.format_exc())
        await update.message.reply_text(
            "Произошла ошибка при обработке команды. Пожалуйста, попробуйте позже."
        )


async def handle_all_callbacks(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработчик всех callback-запросов для отладки (перехватывает ВСЕ колбэки)"""
    try:
        if not update.callback_query:
            return # Не колбэк

        query = update.callback_query
        logger.debug(f"=== Перехвачен ЛЮБОЙ callback-запрос ===")
        logger.debug(f"Данные callback: {query.data}")
        logger.debug(f"От пользователя: {query.from_user.username} ({query.from_user.id})")
        logger.debug(f"В чате: {query.message.chat.title} ({query.message.chat_id})")

        # НЕ отвечаем здесь query.answer(), чтобы дать сработать другим обработчикам
        # await query.answer()

        # Просто логируем, основная работа в handle_deletion_callback
        if query.data and (query.data.startswith('confirm_del_') or query.data.startswith('reject_del_')):
            logger.debug("Это запрос на удаление, будет обработан handle_deletion_callback")
            # Не вызываем здесь handle_deletion_callback, т.к. он уже зарегистрирован отдельно
        else:
            logger.debug("Это НЕ запрос на удаление")

    except Exception as e:
        logger.error(f"Ошибка при общей обработке callback (handle_all_callbacks): {str(e)}")
        # Не отвечаем на колбэк здесь, чтобы не мешать другим обработчикам 