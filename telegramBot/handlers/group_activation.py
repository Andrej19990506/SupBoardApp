import asyncio
import logging
from telegram import Update
from telegram.ext import ContextTypes

logger = logging.getLogger(__name__)

class GroupActivationManager:
    def __init__(self, db_service, valid_time=60):
        self.db_service = db_service
        self.valid_time = valid_time  # Время ожидания пароля (сек)
        self.pending_activations = {}  # chat_id: asyncio.Task
        self.activated_groups = set()  # chat_id, где бот уже активирован
        self.group_handler = None  # Сюда можно передать ссылку на GroupHandler

    def set_group_handler(self, group_handler):
        self.group_handler = group_handler

    async def start_activation(self, chat_id, chat_title, context: ContextTypes.DEFAULT_TYPE):
        """
        Запускает процесс активации бота в группе: отправляет запрос пароля и ждёт ответ.
        Если не получен пароль за valid_time секунд — выходит из группы.
        """
        if chat_id in self.activated_groups:
            logger.info(f"Группа {chat_id} уже активирована, пропускаем активацию.")
            return
        if chat_id in self.pending_activations:
            logger.info(f"Активация уже запущена для группы {chat_id}.")
            return
        logger.info(f"Запуск активации для группы {chat_id} ({chat_title})")
        # Отправляем сообщение с просьбой ввести пароль
        await context.bot.send_message(
            chat_id=chat_id,
            text="Пожалуйста, введите пароль для активации бота в этой группе."
        )
        # Запускаем таймер ожидания
        task = asyncio.create_task(self._wait_for_password(chat_id, context))
        self.pending_activations[chat_id] = task

    async def _wait_for_password(self, chat_id, context: ContextTypes.DEFAULT_TYPE):
        """
        Ждёт valid_time секунд. Если за это время не получен верный пароль — выходит из группы.
        """
        try:
            await asyncio.sleep(self.valid_time)
            if chat_id not in self.activated_groups:
                await context.bot.send_message(
                    chat_id=chat_id,
                    text="Верификация не пройдена. Бот покидает группу."
                )
                await context.bot.leave_chat(chat_id)
                logger.info(f"Бот вышел из группы {chat_id} из-за отсутствия пароля.")
        except Exception as e:
            logger.error(f"Ошибка в таймере активации для группы {chat_id}: {e}")
        finally:
            self.pending_activations.pop(chat_id, None)

    async def check_password(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """
        Проверяет введённый пароль, активирует бота при успехе.
        """
        chat = update.effective_chat
        chat_id = chat.id
        if chat_id in self.activated_groups:
            return  # Уже активирован
        if chat_id not in self.pending_activations:
            return  # Не в режиме ожидания
        # Проверяем, что сообщение текстовое
        if not update.effective_message or not update.effective_message.text:
            return
        valid_password = await self.db_service.get_group_activation_password()
        user_message = update.effective_message.text.strip()
        if user_message == valid_password:
            self.activated_groups.add(chat_id)
            task = self.pending_activations.pop(chat_id, None)
            if task:
                task.cancel()
            await context.bot.send_message(
                chat_id=chat_id,
                text="✅ Бот успешно активирован в этой группе!"
            )
            logger.info(f"Группа {chat_id} успешно активирована по паролю.")
            # --- Сохраняем группу в БД после активации ---
            if self.group_handler:
                await self.save_group_after_activation(chat_id, context)
            return True
        else:
            await context.bot.send_message(
                chat_id=chat_id,
                text="❌ Неверный пароль. Попробуйте ещё раз."
            )
            logger.info(f"Введён неверный пароль для группы {chat_id}.")
            return False

    async def save_group_after_activation(self, chat_id, context: ContextTypes.DEFAULT_TYPE):
        """
        Получает участников и админов через group_handler и сохраняет группу в БД.
        После успешного сохранения отправляет приветственное сообщение.
        """
        if not self.group_handler:
            logger.error("GroupHandler не установлен в GroupActivationManager!")
            return
        try:
            chat = await context.bot.get_chat(chat_id)
            chat_title = chat.title
            members = await self.group_handler._get_chat_members(chat, context)
            admins = await self.group_handler._get_chat_admins(chat_id, context)
            bot_id = await self.group_handler._get_bot_id(context)
            filtered_members = [m for m in members if m['user_id'] != bot_id]
            filtered_admins = [a for a in admins if a['user_id'] != bot_id]
            await self.db_service.save_group(
                chat_id=chat_id,
                chat_title=chat_title,
                members=filtered_members,
                admins=filtered_admins
            )
            logger.info(f"✅ Группа {chat_id} сохранена в БД после успешной активации!")
            # Отправляем приветственное сообщение
            await context.bot.send_message(
                chat_id=chat_id,
                text=f"👋 Бот успешно активирован в группе '{chat_title}'! Теперь доступны все функции."
            )
        except Exception as e:
            logger.error(f"Ошибка при сохранении группы {chat_id} после активации: {e}") 