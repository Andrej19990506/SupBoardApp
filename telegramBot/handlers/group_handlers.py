import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from telegram import Update, ChatMember, Bot, Chat, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove, BotCommand, MenuButton, MenuButtonWebApp, User
from telegram.constants import ChatMemberStatus, ChatType, MenuButtonType
from telegram.ext import ContextTypes, MessageHandler, filters, ChatMemberHandler, CommandHandler, Application, CallbackQueryHandler
import random
import time
import telegram.error
import httpx
import aiofiles
import asyncio
from config.config import Config
from services.database_service import DatabaseService
import traceback
import re
from handlers.group_activation import GroupActivationManager

logger = logging.getLogger(__name__)

def get_member_status(member: ChatMember) -> str:
    """Получает статус участника в читаемом формате"""
    status_map = {
        'creator': 'creator',
        'administrator': 'administrator',
        'member': 'member',
        'restricted': 'restricted',
        'left': 'left',
        'kicked': 'banned',
        'banned': 'banned'
    }
    return status_map.get(member.status, str(member.status).lower())

class GroupHandler:
    def __init__(self, application: Application, db_service: DatabaseService):
        """Инициализация обработчика групповых событий"""
        self.application = application
        self.db_service = db_service # Сохраняем db_service
        self.activation_manager = GroupActivationManager(db_service)
        self.activation_manager.set_group_handler(self)  # Передаю ссылку на себя
        self.bot_id = None  # Инициализируем как None, получим позже
        self.photo_cache = {}  # Инициализируем кэш фотографий
        # --- НАЧАЛО ИЗМЕНЕНИЙ ---
        self._processed_new_member_events = set() # Множество для отслеживания обработанных добавлений участников
        self._processed_events = set() # Множество для отслеживания общих событий (например, добавление бота)
        # --- КОНЕЦ ИЗМЕНЕНИЙ ---
        # Регистрируем обработчики
        self._register_handlers()
        
        logger.info("✅ GroupHandler инициализирован")
    



    async def _clear_processed_groups(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Очистка множества обработанных групп"""
        try:
            if hasattr(self, 'processed_groups'):
                self.processed_groups.clear()
                logger.info("✅ Множество обработанных групп очищено")
        except Exception as e:
            logger.error(f"❌ Ошибка при очистке множества обработанных групп: {str(e)}")
    

    async def handle_new_chat_members(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик добавления новых участников в чат"""
        try:
            chat = update.effective_chat
            new_members = update.message.new_chat_members if update.message else []
            
            # Если бот добавлен в группу — запускаем активацию
            is_bot_added = any(member.id == context.bot.id for member in new_members)
            
            if is_bot_added:
                await self.activation_manager.start_activation(chat.id, chat.title, context)
                return
            
            # Если группа не активирована — пропускаем обработку новых участников
            if chat.id not in self.activation_manager.activated_groups:
                return
            
            # Проверяем, был ли добавлен бот
            is_bot_added = any(member.id == context.bot.id for member in new_members)
            
            if is_bot_added:
                # Создаем уникальный идентификатор события
                event_id = f"bot_added_{chat.id}_{update.message.message_id}"
                
                # Инициализируем множество для отслеживания обработанных событий, если его еще нет
                if not hasattr(self, '_processed_events'):
                    self._processed_events = set()
                
                # Проверяем, не обрабатывали ли мы уже это событие
                if event_id in self._processed_events:
                    logger.info(f"Событие {event_id} уже было обработано, пропускаем")
                    return
                
                # Добавляем событие в множество обработанных
                self._processed_events.add(event_id)
                
                logger.info(f"=== Бот добавлен в чат {chat.title} ===")
                await self._process_bot_added(chat, context)
                return
            
            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # Получаем текущие списки участников и администраторов
            current_members = await self._get_chat_members(chat, context)
            current_admins = await self._get_chat_admins(original_chat_id, context)

            # Обрабатываем каждого нового участника
            for new_member in new_members:
                if new_member.is_bot:  # Пропускаем ботов
                    continue

                # --- НАЧАЛО ИЗМЕНЕНИЙ (Дедупликация) ---
                if update.message: # Убедимся, что есть сообщение для ID
                    event_id = f"new_member_{chat.id}_{new_member.id}_{update.message.message_id}"
                    if event_id in self._processed_new_member_events:
                        logger.info(f"Событие добавления участника {event_id} уже обработано, пропускаем.")
                        continue
                    self._processed_new_member_events.add(event_id)
                else:
                    # Если нет update.message, используем временную метку для примерной дедупликации
                    # Это менее надежно, но лучше, чем ничего
                    timestamp_now = int(time.time())
                    event_id_fallback = f"new_member_{chat.id}_{new_member.id}_{timestamp_now // 5}" # Группируем события в 5-секундные окна
                    if event_id_fallback in self._processed_new_member_events:
                         logger.info(f"Событие добавления участника {event_id_fallback} (по временной метке) уже обработано, пропускаем.")
                         continue
                    self._processed_new_member_events.add(event_id_fallback)
                 # --- КОНЕЦ ИЗМЕНЕНИЙ (Дедупликация) ---

                # --- НАЧАЛО ИЗМЕНЕНИЙ (Приветствие и клавиатура) ---
                # Отправляем приветственное сообщение с клавиатурой
                try:
                    # Измененный текст приветствия
                    welcome_message = f"👋 Добро пожаловать в группу '{chat.title}', {new_member.mention_html()}!"
                    await context.bot.send_message(
                        chat_id=chat.id, # Используем ID из объекта чата
                        text=welcome_message,
                        parse_mode='HTML',
                    )
                    logger.info(f"Отправлено приветствие для {new_member.username or new_member.id} в чат {chat.title} с клавиатурой регистрации")
                except telegram.error.BadRequest as e:
                    # Попытка 2 с original_chat_id (на всякий случай)
                    if "chat not found" in str(e).lower():
                         logger.warning(f"Не удалось отправить приветствие с chat_id={chat.id} (Chat not found), пробую original_chat_id={original_chat_id}")
                         try:
                              await context.bot.send_message(
                                   chat_id=original_chat_id,
                                   text=welcome_message, # Используем новый текст
                                   parse_mode='HTML',
                              )
                              logger.info(f"Отправлено приветствие для {new_member.username or new_member.id} в чат {chat.title} (со второй попытки с original_chat_id) с клавиатурой регистрации")
                         except Exception as e2:
                              logger.error(f"Ошибка отправки приветствия для {new_member.username or new_member.id} в чат {chat.id} (попытка 2 с original_chat_id): {e2}")
                    else:
                        logger.error(f"Ошибка отправки приветствия для {new_member.username or new_member.id} в чат {chat.id}: {e}")
                except Exception as e:
                    logger.error(f"Непредвиденная ошибка при отправке приветствия: {e}")
                # --- КОНЕЦ ИЗМЕНЕНИЙ (Приветствие и клавиатура) ---

                # Получаем фото нового участника
                photo_url = await self._get_user_photo(new_member.id, context, force_update=True)
                
                # Создаем информацию о новом участнике
                member_info = {
                    'user_id': new_member.id,
                    'username': new_member.username,
                    'first_name': new_member.first_name or "",
                    'last_name': new_member.last_name or "",
                    'status': 'member',
                    'joined_date': datetime.now().isoformat(),
                    'is_bot': new_member.is_bot
                }
                
                if photo_url:
                    member_info['photo_url'] = photo_url
                
                # Проверяем, является ли новый участник администратором
                is_admin = await context.bot.get_chat_member(chat.id, new_member.id)
                if is_admin.status in ['administrator', 'creator']:
                    member_info['status'] = is_admin.status
                    if not any(a['user_id'] == new_member.id for a in current_admins):
                        current_admins.append(member_info)
                
                # Добавляем участника в список, если его там еще нет
                if not any(m['user_id'] == new_member.id for m in current_members):
                    current_members.append(member_info)
                    logger.info(f"Добавлен новый участник: {new_member.username or new_member.id}")

        except Exception as e:
            logger.error(f"❌ Ошибка при обработке новых участников: {e}")
            logger.error(traceback.format_exc())

    async def handle_chat_member_update(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик изменения статуса участника в чате"""
        try:
            chat = update.effective_chat
            user = update.chat_member.new_chat_member.user
            old_status = update.chat_member.old_chat_member.status
            new_status = update.chat_member.new_chat_member.status
            
            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # Получаем текущие списки участников и администраторов
            current_members = await self._get_chat_members(chat, context)
            current_admins = await self._get_chat_admins(original_chat_id, context)
            
            # Получаем фото пользователя
            photo_url = await self._get_user_photo(user.id, context, force_update=True)
            
            # Создаем/обновляем информацию о пользователе
            member_info = {
                'user_id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'status': new_status,
                'joined_date': datetime.now().isoformat(),
                'is_bot': user.is_bot
            }
            
            if photo_url:
                member_info['photo_url'] = photo_url
            
            # Обновляем статус в списке участников
            member_updated = False
            for member in current_members:
                if member['user_id'] == user.id:
                    member.update(member_info)
                    member_updated = True
                    break
            
            # Если участника нет в списке, добавляем его
            if not member_updated and new_status not in ['left', 'kicked']:
                current_members.append(member_info)
                logger.info(f"Добавлен новый участник: {user.username or user.id}")
            
            # Обновляем список администраторов
            if new_status in ['administrator', 'creator']:
                # Добавляем в список администраторов
                if not any(a['user_id'] == user.id for a in current_admins):
                    current_admins.append(member_info)
                    logger.info(f"Добавлен новый администратор: {user.username or user.id}")
            elif old_status in ['administrator', 'creator']:
                # Удаляем из списка администраторов
                current_admins = [a for a in current_admins if a['user_id'] != user.id]
                logger.info(f"Удален администратор: {user.username or user.id}")
            

        except Exception as e:
            logger.error(f"❌ Ошибка при обработке изменения статуса участника: {e}")
            logger.error(traceback.format_exc())

    async def _get_standardized_chat_id(self, chat_id: Union[int, str]) -> str:
        """Преобразует ID чата в стандартный формат"""
        str_id = str(chat_id)
        
        # Удаляем префикс -100 для супергрупп
        if str_id.startswith('-100'):
            return str_id[4:]
        # Удаляем префикс - для обычных групп
        elif str_id.startswith('-'):
            return str_id[1:]
        return str_id

    async def _get_original_chat_id(self, standardized_chat_id: Union[int, str]) -> str:
        """Преобразует стандартизированный ID чата в оригинальный формат"""
        str_id = str(standardized_chat_id)
        
        # Проверяем длину ID для определения типа группы
        if len(str_id) >= 10:  # Супергруппа
            return f"-100{str_id}"
        else:  # Обычная группа
            return f"-{str_id}"

    async def _get_user_photo(self, user_id: int, context: ContextTypes.DEFAULT_TYPE, force_update: bool = False) -> Optional[str]:
        """Получение фотографии пользователя"""
        try:
            # Проверяем кэш только если не требуется принудительное обновление
            cache_key = str(user_id)
            if not force_update and cache_key in self.photo_cache:
                logger.info(f"Возвращаем фото из кэша для пользователя {user_id}")
                return self.photo_cache[cache_key]
            
            # Получаем фотографии пользователя
            photos = await context.bot.get_user_profile_photos(user_id, limit=1)
            
            if photos and photos.photos:
                # Берем последнюю фотографию
                photo = photos.photos[0][-1]  # Берем файл с максимальным размером
                
                # Получаем файл
                file = await context.bot.get_file(photo.file_id)
                
                # Проверяем, является ли file.file_path уже полным URL
                if file.file_path.startswith('http'):
                    photo_url = file.file_path
                else:
                    # Формируем URL для загрузки файла
                    bot_token = context.bot.token
                    photo_url = f"https://api.telegram.org/file/bot{bot_token}/{file.file_path}"
                
                # Очищаем URL от возможного дублирования
                if "https://api.telegram.org/file/bot" in photo_url[30:]:
                    photo_url = photo_url[:photo_url.find("/https://")]
                
                # Сохраняем в кэш
                self.photo_cache[cache_key] = photo_url

                
                logger.info(f"Получен URL фото для пользователя {user_id}: {photo_url}")
                return photo_url
            
            logger.warning(f"Фотографии не найдены для пользователя {user_id}")
            return None
            
        except Exception as e:
            logger.error(f"Ошибка при получении фото пользователя {user_id}: {str(e)}")
            logger.error(traceback.format_exc())
            return None

    async def _get_chat_members(self, chat: Chat, context: ContextTypes.DEFAULT_TYPE) -> List[dict]:
        """Получение списка участников чата (без бота)."""
        try:
            logger.info(f"=== Получение участников чата {chat.title} ===")
            members = []
            bot_id = await self._get_bot_id(context) # Получаем ID бота

            # Получаем администраторов, чтобы добавить их
            admins_raw = None
            last_error = None
            successful_id = None
            # Получаем original_chat_id один раз
            original_chat_id_for_admins = await self._get_original_chat_id(await self._get_standardized_chat_id(chat.id))
            chat_id_formats = [chat.id, original_chat_id_for_admins] # Пробуем оба формата

            # logger.info(f"Попытка получить администраторов для _get_chat_members (пробую форматы: {chat_id_formats})")
            for format_id in chat_id_formats:
                 try:
                     admins_raw = await context.bot.get_chat_administrators(format_id)
                     successful_id = format_id
                     # logger.debug(f"Админы для _get_chat_members получены с ID: {successful_id}")
                     break
                 except telegram.error.BadRequest as e:
                     if "chat not found" in str(e).lower():
                         last_error = e
                         continue
                     else:
                         last_error = e
                         break
                 except Exception as e:
                     last_error = e
                     break
            
            if admins_raw is None:
                # Если не удалось получить админов ни с одним ID
                error_msg = f"Не удалось получить администраторов для чата {chat.title} ({chat.id}/{original_chat_id_for_admins}) в _get_chat_members."
                if last_error:
                     error_msg += f" Последняя ошибка: {last_error}"
                logger.error(error_msg)
                # Не поднимаем ошибку, просто возвращаем пустой список участников
                return [] 
            
            # logger.info(f"Обрабатываем {len(admins_raw)} админов для списка участников...")
            for admin_member in admins_raw:
                user = admin_member.user
                if user.id == bot_id: # Пропускаем бота
                    continue
                    
                photo_url = await self._get_user_photo(user.id, context)
                member_info = {
                    'user_id': user.id,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'status': get_member_status(admin_member), # Используем get_member_status
                    'joined_date': datetime.now().isoformat(), # Дата условная, т.к. не знаем когда админ вступил
                    'is_bot': user.is_bot,
                    'photo_url': photo_url
                }
                members.append(member_info)
                logger.info(f"Добавлен администратор (как участник): {user.username or user.id}")

            # Здесь можно добавить логику получения обычных участников, если API позволит
            # На данный момент, для групп бот часто не может получить список всех участников
            # Поэтому пока ограничиваемся администраторами, которых можем получить

            logger.info(f"✅ Получены участники (администраторы) для чата {chat.title} (отфильтровано: {len(members)}). Бот исключен.")
            return members # Возвращаем список, где бота уже не должно быть
            
        except Exception as e:
            logger.error(f"❌ Ошибка при получении списка участников: {str(e)}")
            return []

    async def _get_chat_admins(self, chat_id: Union[int, str], context: ContextTypes.DEFAULT_TYPE) -> List[dict]:
        """Получение списка администраторов чата (без бота)."""
        admin_list = []
        bot_id = await self._get_bot_id(context) # Получаем ID бота
        
        try:
            # logger.info(f"Получение администраторов для чата {chat_id}") # Убрали лог, т.к. он дублируется ниже
            logger.info(f"Получение администраторов для чата {chat_id}")
            
            # Преобразуем chat_id в правильный формат для API
            str_chat_id = str(chat_id)
            
            # Определяем форматы ID для попыток
            chat_id_formats = []
            
            # Сначала пробуем формат обычной группы
            if str_chat_id.startswith('-100'):
                # Если начинается с -100, пробуем сначала обычный формат
                chat_id_formats.append(f"-{str_chat_id[4:]}")
                chat_id_formats.append(str_chat_id)  # Затем оригинальный формат
            elif str_chat_id.startswith('-'):
                chat_id_formats.append(str_chat_id)  # Сначала как есть
                chat_id_formats.append(f"-100{str_chat_id[1:]}")  # Затем формат супергруппы
            else:
                chat_id_formats.append(f"-{str_chat_id}")  # Сначала обычный формат
                chat_id_formats.append(f"-100{str_chat_id}")  # Затем формат супергруппы
            
            admins = None
            last_error = None
            successful_id = None
            
            # Логируем начало попытки
            logger.info(f"Попытка получить администраторов для чата {chat_id} (пробую форматы: {chat_id_formats})")

            # Пробуем получить администраторов с разными форматами ID
            for format_id in chat_id_formats:
                try:
                    # logger.debug(f"Пробую получить админов с ID: {format_id}") # Убираем лог каждой попытки
                    admins = await context.bot.get_chat_administrators(format_id)
                    successful_id = format_id # Запоминаем успешный ID
                    break # Выходим из цикла при успехе
                except telegram.error.BadRequest as e:
                    # Игнорируем 'Chat not found' и пробуем следующий формат
                    if "chat not found" in str(e).lower():
                        last_error = e
                        continue
                    else:
                        # Другая ошибка BadRequest, сохраняем и выходим
                        last_error = e
                        break 
                except Exception as e:
                    last_error = e
                    break # Неожиданная ошибка, выходим
            
            if admins is not None and successful_id:
                 logger.info(f"✅ Администраторы успешно получены с ID: {successful_id}")
            else:
                # Если admins пустой или None после всех попыток
                if last_error:
                    logger.error(f"❌ Не удалось получить администраторов для чата {chat_id} после всех попыток. Последняя ошибка: {last_error}")
                    raise last_error # Поднимаем последнюю ошибку
                else:
                     logger.warning(f"Не удалось получить администраторов для чата {chat_id} (возможно, их нет или нет прав), ошибок не было.")
                return [] # Возвращаем пустой список, если не получили админов
            
            for admin in admins:
                user = admin.user
                admin_info = {
                    'user_id': user.id,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'status': get_member_status(admin),
                    'is_bot': user.is_bot,
                    'can_manage_chat': getattr(admin, 'can_manage_chat', True),
                    'can_delete_messages': getattr(admin, 'can_delete_messages', True),
                    'can_manage_voice_chats': getattr(admin, 'can_manage_voice_chats', True),
                    'can_restrict_members': getattr(admin, 'can_restrict_members', True),
                    'can_promote_members': getattr(admin, 'can_promote_members', True),
                    'can_change_info': getattr(admin, 'can_change_info', True),
                    'can_invite_users': getattr(admin, 'can_invite_users', True),
                    'can_pin_messages': getattr(admin, 'can_pin_messages', True)
                }
                
                # Получаем фото профиля
                photo_url = await self._get_user_photo(user.id, context)
                if photo_url:
                    admin_info['photo_url'] = photo_url
                
                admin_list.append(admin_info)
                logger.info(f"Добавлен администратор: {user.username or user.id}")
            
            logger.info(f"Всего получено {len(admin_list)} администраторов")
            return admin_list
            
        except Exception as e:
            logger.error(f"Ошибка при получении списка администраторов: {str(e)}")
            return []

    # --- НОВЫЙ МЕТОД для получения ID бота с кэшированием ---
    async def _get_bot_id(self, context: ContextTypes.DEFAULT_TYPE) -> int:
        """Получает и кэширует ID бота."""
        if self.bot_id is None:
            try:
                me = await context.bot.get_me()
                self.bot_id = me.id
                logger.info(f"Получен и закэширован ID бота: {self.bot_id}")
            except Exception as e:
                logger.error(f"Не удалось получить ID бота: {e}")
                # В случае ошибки возвращаем 0 или другое значение, 
                # которое точно не совпадет с реальным user_id
                return 0 
        return self.bot_id
    # --- КОНЕЦ НОВОГО МЕТОДА ---

    async def _standardize_chat_id(self, chat_id: Union[int, str]) -> str:
        """Стандартизация ID чата"""
        chat_id_str = str(chat_id)
        
        # Убираем '-100' из начала ID если есть
        if chat_id_str.startswith('-100'):
            return chat_id_str[4:]
        # Убираем '-' из начала ID если есть
        elif chat_id_str.startswith('-'):
            return chat_id_str[1:]
        return chat_id_str

    async def _process_bot_added(self, chat: Chat, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка добавления бота в чат. Только сохраняет данные."""
        try:
            logger.info(f"=== Начало обработки добавления бота в чат {chat.title} (только сохранение данных) ===")

            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")

            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")

            # Получаем список всех участников чата
            logger.info("Получение списка участников...")
            members = await self._get_chat_members(chat, context)
            logger.info(f"Получено {len(members)} участников")

            # Получаем список администраторов
            logger.info("Получение списка администраторов...")
            admins = await self._get_chat_admins(original_chat_id, context)
            logger.info(f"Получено {len(admins)} администраторов")

            # Проверяем и добавляем администраторов в список участников, если их там нет
            for admin in admins:
                if not any(m['user_id'] == admin['user_id'] for m in members):
                    members.append(admin)
                    logger.info(f"Администратор {admin['username'] or admin['user_id']} добавлен в список участников")

            # Фильтруем бота перед сохранением
            bot_id = await self._get_bot_id(context)
            filtered_members = [m for m in members if m['user_id'] != bot_id]
            filtered_admins = [a for a in admins if a['user_id'] != bot_id]

            # Используем self.db_service для всех типов групп
            # await self.db_service.save_group(
            #     chat_id=original_chat_id,
            #     chat_title=chat.title,
            #     members=filtered_members, # Сохраняем отфильтрованных участников
            #     admins=filtered_admins    # Сохраняем отфильтрованных админов
            # )
            # logger.info(f"✅ Отфильтрованные данные группы {chat.title} успешно сохранены в БД после добавления бота")

        except Exception as e:
            logger.error(f"❌ Ошибка при обработке добавления бота (сохранение данных): {str(e)}")
            logger.error(traceback.format_exc())

    async def handle_left_chat_member(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик удаления участника из чата"""
        try:
            chat = update.effective_chat
            user = update.message.left_chat_member if update.message else None
            
            if not user:
                logger.warning("Не удалось определить пользователя, покинувшего чат.")
                return

            # Пропускаем, если бот сам себя удалил (это обрабатывается в handle_my_chat_member)
            if user.id == context.bot.id:
                logger.info("Бот покинул чат, обработка в handle_my_chat_member.")
                return

            logger.info(f"Участник {user.username or user.id} покинул чат {chat.title} (ID: {chat.id})")

            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            # logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            # logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # --- НОВАЯ ЛОГИКА ---
            # Вызываем метод сервиса базы данных для удаления пользователя и его данных из группы
            db_service = self.db_service # Используем сохраненный сервис
            if db_service:
                logger.info(f"Вызов удаления участника user_id: {user.id} из группы chat_id: {original_chat_id} через DatabaseService...")
                deleted = await db_service.remove_member_from_group(original_chat_id, user.id)
                if deleted:
                    logger.info(f"Удаление участника {user.id} из группы {original_chat_id} в БД прошло успешно.")
                else:
                    logger.warning(f"Удаление участника {user.id} из группы {original_chat_id} в БД не выполнено (возможно, уже удален или ошибка).")
            else:
                 logger.error("DatabaseService не инициализирован или недоступен в application при обработке выхода участника.")

        except Exception as e:
            logger.error(f"❌ Ошибка при обработке выхода участника: {e}")
            logger.error(traceback.format_exc())

    async def handle_webapp_data(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка данных от веб-приложения"""
        try:
            if not update.message or not update.message.web_app_data:
                return
                
            data = json.loads(update.message.web_app_data.data)
            logger.info(f"Получены данные от веб-приложения: {data}")
            
            # Здесь можно добавить обработку различных типов данных
            # Например, регистрация курьера, обновление профиля и т.д.
            
            await update.message.reply_text(
                "Спасибо за регистрацию! Мы свяжемся с вами в ближайшее время."
            )
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке данных веб-приложения: {e}")
            logger.error(traceback.format_exc())
            await update.message.reply_text(
                "Произошла ошибка при обработке данных. Пожалуйста, попробуйте позже."
            )
          
    async def handle_profile_photo_update(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка обновления фотографии профиля"""
        try:
            if not update.message or not update.message.from_user:
                return

            user = update.message.from_user
            chat = update.effective_chat
            chat_id = await self._get_standardized_chat_id(chat.id)

            # Получаем новое фото профиля
            photo_url = await self._get_user_photo(user.id, context)
            if not photo_url:
                logger.warning(f"Не удалось получить новое фото профиля для пользователя {user.id}")
                return
                
                # Сохраняем обновленные данные
                await self.db_service.save_group(
                    chat_id=chat_id,
                    chat_title=chat.title,
                members=await self._get_chat_members(chat, context),
                admins=await self._get_chat_admins(chat_id, context)
            )
            logger.info(f"✅ Фотографии успешно обновлены для пользователя {user.id} в чате {chat.title}")

        except Exception as e:
            logger.error(f"Ошибка при обновлении фото профиля: {str(e)}", exc_info=True)

    async def update_all_photos(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Периодическое обновление фотографий всех участников"""
        try:
            logger.info("🚀 Запуск периодического обновления фотографий...")
            
            # Получаем все группы из БД
            all_groups_data = await self.db_service.get_all_groups()

            if not all_groups_data:
                logger.info("Нет групп для обновления фотографий.")
                return

            updated_photos_count = 0
            for group in all_groups_data:
                chat_id = group.get('chat_id')
                chat_title = group.get('title')
                members = group.get('members')
                
                if not members or not chat_id:
                    continue
                    
                logger.info(f"Обновление фото для группы '{chat_title}' ({chat_id})...")
                try:
                    # Получаем текущие данные о группе
                    current_members = await self._get_chat_members(chat_id)
                    current_admins = await self._get_chat_admins(chat_id, context)
                    
                    # Обновляем фотографии для каждого участника
                    for member in current_members:
                        if not member.get('is_bot'):
                            user_id = int(member.get('user_id'))
                            new_photo = await self._get_user_photo(user_id, context)
                            if new_photo and new_photo != member.get('photo_url'):
                                member['photo_url'] = new_photo
                                logger.info(f"Обновлено фото участника {user_id} в группе {chat_title}")
                    
                    for admin in current_admins:
                        if not admin.get('is_bot'):
                            user_id = int(admin.get('user_id'))
                            new_photo = await self._get_user_photo(user_id, context)
                            if new_photo and new_photo != admin.get('photo_url'):
                                admin['photo_url'] = new_photo
                                logger.info(f"Обновлено фото администратора {user_id} в группе {chat_title}")
                    
                    # Сохраняем обновленные данные через db_service
                    await self.db_service.save_group(
                        chat_id=chat_id,
                        chat_title=chat_title,
                        members=current_members,
                        admins=current_admins
                    )
                    logger.info(f"✅ Успешно обновлены фотографии в группе {chat_title}")
                    updated_photos_count += 1
                except Exception as e:
                    logger.error(f"Ошибка при обновлении фотографий для чата {chat_id}: {e}")
                    continue
            
            logger.info(f"✅ Периодическое обновление фотографий завершено. Обновлено фотографий: {updated_photos_count}")
            
        except Exception as e:
            logger.error(f"Ошибка при периодическом обновлении фотографий: {e}", exc_info=True)

    async def handle_my_chat_member(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработка обновления статуса бота в чате (добавление, удаление, изменение прав)."""
        try:
            chat_member_update = update.my_chat_member
            if not chat_member_update:
                logger.warning("Получено обновление ChatMember, но my_chat_member отсутствует.")
                return

            chat = chat_member_update.chat
            old_member = chat_member_update.old_chat_member
            new_member = chat_member_update.new_chat_member

            old_status = old_member.status if old_member else None
            new_status = new_member.status if new_member else None

            # Используем f-string аккуратно, без лишних кавычек внутри
            chat_title_safe = chat.title.replace("'", "\\\\'") # Экранируем кавычки для логов
            logger.info(f"=== Обновление статуса бота в чате '{chat_title_safe}' (ID: {chat.id}) ===")
            logger.info(f"Старый статус: {old_status}, Новый статус: {new_status}")

            # Получаем стандартизированный ID чата
            standardized_chat_id = await self._get_standardized_chat_id(chat.id)
            original_chat_id = await self._get_original_chat_id(standardized_chat_id) # Используем для API и сохранения

            # --- НОВАЯ ЛОГИКА: Отправка приветствия и обработка добавления/изменения прав ---
            if new_status in [ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR]:
                # Бота добавили или сделали админом
                if new_status == ChatMemberStatus.MEMBER and old_status != ChatMemberStatus.MEMBER:
                    logger.info(f"Бота ({self.bot_id}) добавили как участника в чат '{chat_title_safe}' ({chat.id}).")
                elif new_status == ChatMemberStatus.ADMINISTRATOR:
                     logger.info(f"Бота ({self.bot_id}) сделали администратором в чате '{chat_title_safe}' ({chat.id}). Обновляем данные.")

                # 1. Сохраняем/Обновляем данные о группе (вызываем _process_bot_added) - ДЕЛАЕМ ВСЕГДА
                await self._process_bot_added(chat, context)

    
                         
            # --- Логика удаления ---
            elif new_status in [ChatMemberStatus.LEFT, ChatMemberStatus.BANNED]:
                # Бота удалили или он сам вышел
                logger.warning(f"Бота ({self.bot_id}) удалили (статус: {new_status}) из чата '{chat_title_safe}' ({original_chat_id}).")
                # Удаляем всю информацию о группе
                await self._delete_group_data(original_chat_id, chat.title)

            # --- Прочие статусы ---
            else:
                 logger.info(f"Статус бота ({self.bot_id}) в чате '{chat_title_safe}' ({chat.id}) изменен с {old_status} на {new_status}. Это изменение не требует специальных действий в handle_my_chat_member.")

        except Exception as e:
            chat_id_for_error = update.effective_chat.id if update.effective_chat else "Неизвестно"
            logger.error(f"❌ Ошибка в handle_my_chat_member для чата {chat_id_for_error}: {e}")
            logger.error(traceback.format_exc())
            
    async def _delete_group_data(self, chat_id: str, chat_title: str) -> None:
        """Удаляет все данные, связанные с группой, из БД."""
        # Используем f-string аккуратно
        chat_title_safe = chat_title.replace("'", "\\'") # Экранируем кавычки для логов
        logger.warning(f"=== ЗАПУСК УДАЛЕНИЯ ДАННЫХ для группы '{chat_title_safe}' (ID: {chat_id}) ===" )
        try:
            # 1. Удаление из базы данных (через DatabaseService)
            db_service = self.db_service # Используем сохраненный сервис
            if db_service:
                logger.info(f"Вызов удаления данных из БД для чата {chat_id} через DatabaseService...")
                # Используем новый асинхронный метод delete_group
                deleted = await db_service.delete_group(chat_id)
                if deleted:
                    logger.info(f"✅ Данные группы '{chat_title}' (ID: {chat_id}) успешно удалены из БД.")
                else:
                    logger.warning(f"Удаление из БД для чата {chat_id} не выполнено (возможно, группа уже удалена или произошла ошибка).")
            else:
                logger.error("DatabaseService не инициализирован или недоступен в application.")

            logger.warning(f"✅ УДАЛЕНИЕ ДАННЫХ для группы '{chat_title_safe}' (ID: {chat_id}) ЗАВЕРШЕНО." )

        except Exception as e:
            # Используем f-string аккуратно
            logger.error(f"❌ Ошибка при удалении данных для группы '{chat_title_safe}' (ID: {chat_id}): {e}")
            logger.error(traceback.format_exc())

    async def _notify_server_about_admin_update(self, chat_id: str, admins_data: dict) -> None:
        """Уведомление сервера об обновлении списка администраторов"""
        try:
            # Получаем стандартизированный ID чата для сохранения данных
            standardized_chat_id = await self._get_standardized_chat_id(chat_id)
            logger.info(f"Стандартизированный ID чата: {standardized_chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(standardized_chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # Отправляем данные на сервер
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.server_url}/api/admin/update",
                    json={
                        "chat_id": original_chat_id,
                        "admins": admins_data
                    }
                ) as response:
                    if response.status == 200:
                        logger.info(f"✅ Сервер успешно уведомлен об обновлении администраторов для чата {original_chat_id}")
                    else:
                        logger.error(f"❌ Ошибка при уведомлении сервера: {response.status}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при уведомлении сервера: {e}")
            logger.error(traceback.format_exc())

    def _register_handlers(self):
        """Регистрация обработчиков групповых событий"""
        try:
            # Регистрируем только обработчик NEW_CHAT_MEMBERS для добавления бота
            self.application.add_handler(
                MessageHandler(
                    filters.StatusUpdate.NEW_CHAT_MEMBERS,
                    self.handle_new_chat_members
                )
            )
            logger.info("✅ Обработчик добавления новых участников зарегистрирован")
            
            # Регистрируем обработчик изменения статуса участника
            self.application.add_handler(
                ChatMemberHandler(
                    self.handle_chat_member_update,
                    ChatMemberHandler.CHAT_MEMBER
                )
            )
            logger.info("✅ Обработчик изменения статуса участника зарегистрирован")
            
            # Регистрируем обработчик удаления участника
            self.application.add_handler(
                MessageHandler(
                    filters.StatusUpdate.LEFT_CHAT_MEMBER,
                    self.handle_left_chat_member
                )
            )
            logger.info("✅ Обработчик удаления участника зарегистрирован")
            
            # Регистрируем обработчик получения контакта
            self.application.add_handler(
                MessageHandler(
                    filters.CONTACT,
                    self.handle_contact
                )
            )
            logger.info("✅ Обработчик получения контакта зарегистрирован")
            
            # Регистрируем обработчик получения фото
            self.application.add_handler(
                MessageHandler(
                    filters.PHOTO,
                    self.handle_photo
                )
            )
            logger.info("✅ Обработчик получения фото зарегистрирован")
            
            # Регистрируем обработчик данных веб-приложения
            self.application.add_handler(
                MessageHandler(
                    filters.StatusUpdate.WEB_APP_DATA,
                    self.handle_webapp_data
                )
            )
            logger.info("✅ Обработчик данных веб-приложения зарегистрирован")

            # ВРЕМЕННО: Регистрируем обработчик на все сообщения в группах для диагностики
            async def group_password_handler(update, context):
                logger.info(f"[DEBUG] group_password_handler вызван! update={update}")
                chat = update.effective_chat
                logger.info(f"[DEBUG] group_password_handler: chat_id={getattr(chat, 'id', None)}, type={getattr(chat, 'type', None)}, pending={getattr(chat, 'id', None) in self.activation_manager.pending_activations}, activated={getattr(chat, 'id', None) in self.activation_manager.activated_groups}")
                if chat and chat.type in ["group", "supergroup"]:
                    # Проверяем, что группа не активирована и бот ждёт пароль
                    if chat.id in self.activation_manager.pending_activations and chat.id not in self.activation_manager.activated_groups:
                        logger.info(f"[DEBUG] Проверка пароля для группы {chat.id} (ожидание пароля)")
                        await self.activation_manager.check_password(update, context)
                    else:
                        logger.info(f"[DEBUG] Игнорируем сообщение: группа {chat.id} не в режиме ожидания пароля")
                else:
                    logger.info(f"[DEBUG] Игнорируем сообщение: не группа или супергруппа")
            self.application.add_handler(MessageHandler(filters.ALL, group_password_handler), group=0)

            logger.info("✅ [DEBUG] Диагностический обработчик проверки пароля зарегистрирован на ВСЕ сообщения с group=0 (первый)")

            logger.info("✅ Все обработчики групповых событий зарегистрированы")
            
        except Exception as e:
            logger.error(f"❌ Ошибка при регистрации обработчиков: {e}")
            logger.error(traceback.format_exc())
            raise

    async def handle_contact(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик получения контакта от пользователя"""
        try:
            message = update.effective_message
            contact = message.contact
            user = message.from_user
            chat = message.chat
            
            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # Загружаем текущие данные из admins.json
            data = self.json_service.load_from_json('admins.json')
            success_count = 0
            
            # Обновляем информацию во всех чатах (этот цикл теперь не нужен или должен работать с БД)
            # Заменяем или удаляем цикл, так как он полагался на JSON
            # Вместо этого обновляем только для текущего чата в БД
            
            current_admins = await self._get_chat_admins(original_chat_id, context)
            updated_in_db = False
            for admin in current_admins:
                 if admin.get('user_id') == user.id:
                     admin['phone'] = contact.phone_number # Добавляем поле phone
                     updated_in_db = True
                     logger.info(f"✅ Обновлен контакт администратора user_id: {user.id} в данных группы chat_id: {original_chat_id}")
                     break

            if updated_in_db:
                 # Сохраняем обновленные данные администраторов в БД для текущей группы
                 # Предполагаем, что save_group обновит админов, если передать только их
                 await self.db_service.save_group(
                     chat_id=original_chat_id,
                     chat_title=chat.title, # Получаем актуальное название
                     members=await self._get_chat_members(chat, context), # Передаем текущих участников
                     admins=current_admins # Передаем обновленных админов
                 )
                 success_count = 1 # Обновили в одной группе (текущей)

            if success_count > 0:
                await message.reply_text(
                    f"✅ Контакт успешно сохранен.", # Убрали кол-во групп
                    reply_markup=ReplyKeyboardRemove()
                )
            else:
                await message.reply_text(
                    "❌ Произошла ошибка при сохранении контакта. Пожалуйста, попробуйте позже.",
                    reply_markup=ReplyKeyboardRemove()
                )
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке контакта: {e}")
            logger.error(traceback.format_exc())

    async def handle_photo(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик получения нового фото профиля"""
        try:
            message = update.effective_message
            user = message.from_user
            chat = message.chat
            
            # Получаем стандартизированный ID чата для сохранения данных
            chat_id = await self._get_standardized_chat_id(chat.id)
            logger.info(f"Стандартизированный ID чата: {chat_id}")
            
            # Получаем оригинальный ID чата для API запросов
            original_chat_id = await self._get_original_chat_id(chat_id)
            logger.info(f"Оригинальный ID чата для API: {original_chat_id}")
            
            # Получаем новое фото профиля
            photo_url = await self._get_user_photo(user.id, context)
            if not photo_url:
                logger.warning(f"Не удалось получить новое фото профиля для пользователя {user.id}")
                return
                
                # Сохраняем обновленные данные
                await self.db_service.save_group(
                chat_id=chat_id,
                    chat_title=chat.title,
                members=await self._get_chat_members(chat, context),
                admins=await self._get_chat_admins(original_chat_id, context)
            )
                logger.info(f"✅ Успешно обновлены фотографии для пользователя {user.id} в чате {chat.title}")
            
        except Exception as e:
            logger.error(f"Ошибка при обновлении фото профиля: {str(e)}", exc_info=True)

 