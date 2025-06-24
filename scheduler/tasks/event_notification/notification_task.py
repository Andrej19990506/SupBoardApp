import logging
import pytz
from typing import List, Dict, Any, TYPE_CHECKING
from datetime import datetime, timedelta
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.cron import CronTrigger
import httpx
import asyncio # <<< Добавляем asyncio для sleep
import json

# Импортируем базовый класс и зависимости
from ..base_task import BaseTask
from core.config import SchedulerSettings # Используем SchedulerSettings для типизации
from services.database_service import DatabaseService # Используем DatabaseService для типизации
from tasks.event_reminder.reminder_task import EventReminderTask

# Осторожно с циклическими импортами!
if TYPE_CHECKING:
    from tasks.task_manager import TaskManager
    from apscheduler.schedulers.base import BaseScheduler

logger = logging.getLogger(__name__)

# --- Статическая функция-обертка для APScheduler ---
async def send_notification(**kwargs):
    """
    Статическая обертка, вызываемая APScheduler.
    Извлекает данные и настройки, создает экземпляр EventNotificationTask
    и вызывает его метод execute.
    """
    job_id = kwargs.get('job_id')
    message = kwargs.get('message')
    chat_ids = kwargs.get('chat_ids')
    settings = kwargs.get('settings') # <<< Получаем настройки
    notification_id = kwargs.get('notification_id')
    confirmation_type = kwargs.get('confirmation_type', 'default') # По умолчанию 'default'

    if not all([job_id, message, chat_ids, settings, notification_id]):
        logger.error(f"[send_notification:{job_id}] Недостаточно данных, настроек или notification_id в kwargs для выполнения.")
        return

    logger.info(f"[send_notification:{job_id}] Запуск execute для уведомления.")

    try:
        # <<< Создаем экземпляр задачи, передавая настройки >>>
        # scheduler_instance и task_manager не нужны для execute, передаем None
        task_instance = EventNotificationTask(scheduler_instance=None, task_manager=None, settings=settings)
        # <<< Вызываем НЕСТАТИЧЕСКИЙ метод execute >>>
        await task_instance.execute(**kwargs) 
        logger.info(f"[send_notification:{job_id}] Вызов execute завершен.")
    except Exception as e:
        logger.error(f"[send_notification:{job_id}] Ошибка при выполнении execute: {e}", exc_info=True)

# --- Класс задачи ---
class EventNotificationTask(BaseTask):
    TASK_TYPE = 'event_notification'

    def __init__(self, scheduler_instance: 'BaseScheduler', task_manager: 'TaskManager', settings: SchedulerSettings):
        """
        Задача для отправки уведомлений о событиях.
        """
        super().__init__(scheduler_instance, task_manager, settings)
        self.timezone = pytz.timezone(self.settings.TIMEZONE) # Берем таймзону из настроек
        logger.debug(f"EventNotificationTask инициализирован. Таймзона: {self.settings.TIMEZONE}")

    async def schedule(self, notification_data: Dict[str, Any]):
        """
        Планирует или обновляет задачу отправки уведомления о событии.
        Вызывается из TaskManager или API шедулера.
        """
        job_id = None # Инициализируем job_id
        try:
            # Извлекаем необходимые данные
            notification_id = notification_data.get('notification_id')
            event_date_str = notification_data.get('event_date')
            time_before = notification_data.get('time_before')
            repeat_settings = notification_data.get('repeat', {})
            message = notification_data.get('message')
            chat_ids = notification_data.get('chat_ids')
            
            # Новые параметры для управления временем уведомления
            use_absolute_time = notification_data.get('use_absolute_time', False)
            absolute_time = notification_data.get('absolute_time')
            send_now = notification_data.get('send_now', False)
            
            # Логируем полученные параметры для отладки
            logger.info(f"({self.TASK_TYPE}) Получены параметры времени: send_now={send_now}, use_absolute_time={use_absolute_time}")
            logger.debug(f"({self.TASK_TYPE}) Полные данные уведомления: {notification_data}")
            
            # Логируем исходные значения параметров до преобразований
            raw_send_now = notification_data.get('send_now')
            raw_use_absolute_time = notification_data.get('use_absolute_time')
            logger.info(f"({self.TASK_TYPE}) Исходные значения параметров: raw_send_now={raw_send_now} (тип: {type(raw_send_now)}), raw_use_absolute_time={raw_use_absolute_time} (тип: {type(raw_use_absolute_time)})")

            if not all([notification_id, message, chat_ids]):
                logger.error(f"({self.TASK_TYPE}) Недостаточно данных для планирования: {notification_data}")
                return False
                
            # Проверяем наличие необходимых параметров времени в зависимости от режима
            if not send_now and not use_absolute_time and (event_date_str is None or time_before is None):
                logger.error(f"({self.TASK_TYPE}) Для относительного времени требуются event_date и time_before: {notification_data}")
                return False
                
            if use_absolute_time and not absolute_time:
                logger.error(f"({self.TASK_TYPE}) Для абсолютного времени требуется absolute_time: {notification_data}")
                return False

            # Генерируем ID задачи используя метод базового класса
            job_id = self.generate_task_id(self.TASK_TYPE, str(notification_id))
            
            # --- Определение времени запуска в зависимости от режима ---
            now_aware = datetime.now(self.timezone)
            trigger_time = None
            
            # Дополнительная защита - явно приводим к булевым типам
            send_now = bool(send_now)
            use_absolute_time = bool(use_absolute_time)
            
            logger.info(f"({self.TASK_TYPE}:{job_id}) Выбор режима времени: send_now={send_now}, use_absolute_time={use_absolute_time}")
            
            if send_now:
                # Если отправка немедленно, устанавливаем время запуска через 5 секунд
                trigger_time = now_aware + timedelta(seconds=5)
                logger.info(f"({self.TASK_TYPE}:{job_id}) Уведомление будет отправлено немедленно (через 5 сек)")
            elif use_absolute_time:
                # Если указано абсолютное время
                try:
                    # Проверяем, содержит ли строка absolute_time информацию о часовом поясе
                    has_timezone_info = '+' in absolute_time or '-' in absolute_time or 'Z' in absolute_time

                    trigger_time = datetime.fromisoformat(absolute_time)
                    
                    # Если в строке не было информации о часовом поясе, предполагаем, 
                    # что время указано в локальном часовом поясе системы
                    if trigger_time.tzinfo is None or trigger_time.tzinfo.utcoffset(trigger_time) is None:
                        if has_timezone_info:
                            # Если в строке были символы часового пояса, но datetime не распознал их,
                            # скорее всего время уже в UTC и его нужно просто привести к таймзоне системы
                            trigger_time = pytz.utc.localize(trigger_time).astimezone(self.timezone)
                        else:
                            # Если нет информации о часовом поясе, предполагаем, что время
                            # указано в том же часовом поясе, что и настроен в системе
                            trigger_time = self.timezone.localize(trigger_time)
                            
                            # Логируем для отладки, что используем системную таймзону
                            logger.info(f"({self.TASK_TYPE}:{job_id}) Абсолютное время без указания часового пояса интерпретировано как локальное время в {self.settings.TIMEZONE}")
                    else:
                        # Если время уже содержит информацию о часовом поясе,
                        # просто приводим его к часовому поясу системы
                        trigger_time = trigger_time.astimezone(self.timezone)
                    
                    logger.info(f"({self.TASK_TYPE}:{job_id}) Установлено абсолютное время уведомления: {trigger_time}")
                except ValueError as e:
                    logger.error(f"({self.TASK_TYPE}:{job_id}) Ошибка парсинга абсолютной даты '{absolute_time}': {e}")
                    return False
            else:
                # Стандартный режим - относительно времени события
                try:
                    event_date = datetime.fromisoformat(event_date_str)
                    if event_date.tzinfo is None or event_date.tzinfo.utcoffset(event_date) is None:
                        event_date = pytz.utc.localize(event_date).astimezone(self.timezone)
                    else:
                        event_date = event_date.astimezone(self.timezone)
                    
                    trigger_time = event_date - timedelta(minutes=int(time_before))
                    logger.info(f"({self.TASK_TYPE}:{job_id}) Установлено относительное время уведомления: {trigger_time} (за {time_before} мин до {event_date})")
                except ValueError as e:
                    logger.error(f"({self.TASK_TYPE}:{job_id}) Ошибка парсинга даты события '{event_date_str}' или time_before '{time_before}': {e}")
                    return False
            
            # Проверяем, не в прошлом ли время запуска
            if trigger_time < now_aware:
                logger.warning(f"({self.TASK_TYPE}:{job_id}) Расчетное время запуска ({trigger_time}) уже прошло. Сейчас: {now_aware}")
                
                # Для одноразовых уведомлений в прошлом
                if repeat_settings.get('type', 'none') == 'none' and not send_now:
                    logger.warning(f"({self.TASK_TYPE}:{job_id}) Одноразовое уведомление в прошлом, не будет запланировано.")
                    # Удаляем задачу на всякий случай
                    await self.task_manager.delete_task(job_id) # Используем метод менеджера
                    return True
                elif send_now:
                    # Если отправка немедленно, то перерассчитываем время запуска
                    trigger_time = now_aware + timedelta(seconds=5)
                    logger.info(f"({self.TASK_TYPE}:{job_id}) Уведомление с send_now=true будет отправлено немедленно, перерассчитано время: {trigger_time}")
                else:
                    # Для повторяющихся - продолжаем, APScheduler разберется с ближайшим временем запуска
                    pass

            # --- Определение триггера ---
            trigger = None
            repeat_type = repeat_settings.get('type', 'none')

            if repeat_type == 'none' or send_now:
                trigger = DateTrigger(run_date=trigger_time, timezone=self.timezone)
            else:
                # Остальная логика для повторений без изменений
                cron_args = {
                    'hour': trigger_time.hour, 'minute': trigger_time.minute,
                    'timezone': self.timezone, 'start_date': trigger_time
                }
                if repeat_type == 'daily':
                    trigger = CronTrigger(**cron_args)
                elif repeat_type == 'weekly':
                    weekdays = repeat_settings.get('weekdays')
                    if weekdays is not None and isinstance(weekdays, list):
                        aps_weekdays = [(d - 1 + 7) % 7 for d in weekdays] # 0=Пн .. 6=Вс
                        cron_args['day_of_week'] = ",".join(map(str, aps_weekdays))
                        trigger = CronTrigger(**cron_args)
                    else:
                        logger.error(f"({self.TASK_TYPE}:{job_id}) Некорректные weekdays: {weekdays}")
                        return False
                elif repeat_type == 'monthly':
                    month_day = repeat_settings.get('month_day')
                    if month_day is not None:
                        cron_args['day'] = str(month_day)
                        trigger = CronTrigger(**cron_args)
                    else:
                        logger.error(f"({self.TASK_TYPE}:{job_id}) Некорректный month_day: {month_day}")
                        return False
                else:
                    logger.error(f"({self.TASK_TYPE}:{job_id}) Неизвестный тип повтора: {repeat_type}")
                    return False

            if trigger is None:
                 logger.error(f"({self.TASK_TYPE}:{job_id}) Не удалось создать триггер.")
                 return False

            # --- Подготовка данных ---
            executor_path = self.task_manager.task_executors.get(self.TASK_TYPE)
            if not executor_path:
                logger.error(f"({self.TASK_TYPE}:{job_id}) Путь к исполнителю не найден в task_manager.")
                return False

            # <<< ИЗМЕНЕНИЕ: Добавляем requires_confirmation и notification_id >>>
            requires_confirmation = notification_data.get('requires_confirmation', False)
            notification_id = notification_data.get('notification_id') # Нужен для callback_data
            # <<< ИЗМЕНЕНИЕ: Определяем тип подтверждения для восстановления >>>
            confirmation_type = 'default'
            if requires_confirmation and message:
                # --- ДОБАВЛЯЕМ ЛОГИРОВАНИЕ --- 
                logger.info(f"({self.TASK_TYPE}:{job_id}) Проверка confirmation_type. Message: '{message[:100]}...'") # Логируем начало сообщения
                contains_shift_ends = "смена завершается" in message.lower()
                contains_fire_safety = "пожарная безопасность" in message.lower()
                logger.info(f"({self.TASK_TYPE}:{job_id}) Содержит 'смена завершается': {contains_shift_ends}, Содержит 'пожарная безопасность': {contains_fire_safety}")
                # --- КОНЕЦ ЛОГИРОВАНИЯ ---
                if contains_shift_ends and contains_fire_safety:
                    confirmation_type = 'end_of_shift'
            # --- ДОБАВЛЯЕМ ЛОГИРОВАНИЕ РЕЗУЛЬТАТА --- 
            logger.info(f"({self.TASK_TYPE}:{job_id}) Установлен confirmation_type: '{confirmation_type}'")
            # --- КОНЕЦ ЛОГИРОВАНИЯ ---

            job_kwargs_for_executor = {
                'message': message,
                'chat_ids': chat_ids,
                'job_id': job_id,
                'settings': self.settings,
                'requires_confirmation': requires_confirmation,
                'notification_id': notification_id,
                # <<< ИЗМЕНЕНИЕ: Передаем тип подтверждения >>>
                'confirmation_type': confirmation_type,
                # <<< ИЗМЕНЕНИЕ: Передаем TaskManager для доступа к другим задачам >>>
                'task_manager': self.task_manager
            }

            # --- Добавление/Обновление задачи в APScheduler ---
            try:
                existing_job = self.scheduler.get_job(job_id)
                if existing_job:
                    self.scheduler.modify_job(job_id, trigger=trigger, kwargs=job_kwargs_for_executor)
                    logger.info(f"({self.TASK_TYPE}:{job_id}) Задача ОБНОВЛЕНА в APScheduler.")
                else:
                    self.scheduler.add_job(
                        executor_path,
                        trigger=trigger,
                        kwargs=job_kwargs_for_executor,
                        id=job_id,
                        name=f'{self.TASK_TYPE}_{job_id}',
                        replace_existing=False, # Уже проверили через get_job
                        misfire_grace_time=3600
                    )
                    logger.info(f"({self.TASK_TYPE}:{job_id}) Задача ДОБАВЛЕНА в APScheduler.")
            except Exception as job_err:
                logger.error(f"({self.TASK_TYPE}:{job_id}) Ошибка APScheduler: {job_err}", exc_info=True)
                return False

            # --- Сохранение/Обновление в кастомной БД ---
            if self.task_manager.db_service:
                job = self.scheduler.get_job(job_id)
                actual_next_run_time = job.next_run_time if job else trigger_time
                actual_next_run_time_utc = actual_next_run_time.astimezone(pytz.utc) if actual_next_run_time else None

                db_save_data = {
                    'task_id': job_id,
                    'chat_id': None,
                    'task_type': self.TASK_TYPE,
                    'next_run_time': actual_next_run_time_utc,
                    # <<< ИЗМЕНЕНИЕ: СОХРАНЯЕМ ВСЕ ПОЛУЧЕННЫЕ notification_data + confirmation_type >>>
                    'data': {
                        **notification_data, # Копируем все исходные данные
                        'confirmation_type': confirmation_type # Добавляем или перезаписываем тип
                    },
                }
                try:
                    save_db_success = await self.task_manager.db_service.save_task(db_save_data)
                    if not save_db_success:
                         logger.error(f"({self.TASK_TYPE}:{job_id}) Ошибка сохранения/обновления в scheduler_tasks.")
                         # Не возвращаем False, т.к. в APScheduler уже запланировано
                except Exception as db_err:
                    logger.error(f"({self.TASK_TYPE}:{job_id}) Исключение при сохранении/обновлении в scheduler_tasks: {db_err}", exc_info=True)

            return True # Возвращаем True, если дошли до сюда

        except Exception as e:
            logger.error(f"({self.TASK_TYPE}) Непредвиденная ошибка при планировании {job_id or notification_data.get('notification_id')}: {e}", exc_info=True)
            return False

    # --- Добавляем вспомогательную функцию для разбиения длинных сообщений ---
    def split_message(self, message, max_length=4000):
        """
        Разбивает длинное сообщение на части, не превышающие max_length символов.
        Для Telegram API лимит составляет примерно 4096 символов.
        """
        if len(message) <= max_length:
            return [message]
            
        parts = []
        text_left = message
        
        while len(text_left) > 0:
            if len(text_left) <= max_length:
                parts.append(text_left)
                break
                
            # Находим последний перенос строки в пределах допустимой длины
            pos = text_left[:max_length].rfind('\n')
            if pos <= 0:  # Если нет переноса строки, ищем пробел
                pos = text_left[:max_length].rfind(' ')
            if pos <= 0:  # Если нет удобного места для разбиения, просто разбиваем по длине
                pos = max_length
                
            parts.append(text_left[:pos])
            text_left = text_left[pos:].lstrip()
            
        logger.info(f"Сообщение разбито на {len(parts)} частей.")
        return parts

    # --- Метод execute ТЕПЕРЬ НЕ СТАТИЧЕСКИЙ --- 
    async def execute(self, **kwargs):
        """
        Выполняет основную логику задачи - отправку уведомления.
        Теперь это метод экземпляра, имеет доступ к self.settings.
        """
        job_id = kwargs.get('job_id')
        message = kwargs.get('message')
        chat_ids = kwargs.get('chat_ids')
        # <<< ИЗМЕНЕНИЕ: Получаем requires_confirmation >>>
        requires_confirmation = kwargs.get('requires_confirmation', False)
        # <<< ИЗМЕНЕНИЕ: Получаем notification_id >>>
        notification_id = kwargs.get('notification_id')
        # <<< ИЗМЕНЕНИЕ: Получаем confirmation_type >>>
        confirmation_type = kwargs.get('confirmation_type', 'default')
        # <<< ИЗМЕНЕНИЕ: Получаем task_manager >>>
        task_manager = kwargs.get('task_manager')

        logger.info(f"({self.TASK_TYPE}:{job_id}) Начало выполнения execute. Confirmation required: {requires_confirmation}, Type: {confirmation_type}")

        if not message or not chat_ids:
            logger.error(f"({self.TASK_TYPE}:{job_id}) Отсутствует сообщение или список чатов в kwargs. Отправка невозможна.")
            return
            
        if not isinstance(chat_ids, list):
             logger.error(f"({self.TASK_TYPE}:{job_id}) chat_ids не является списком: {chat_ids}. Отправка невозможна.")
             return

        # --- Получаем URL Бота --- 
        bot_api_url = getattr(self.settings, 'BOT_API_URL', None)
        if not bot_api_url:
            logger.error(f"({self.TASK_TYPE}:{job_id}) URL API телеграм-бота (BOT_API_URL) не задан в настройках.")
            return
        base_bot_url = str(bot_api_url).rstrip('/')
        send_endpoint = f"{base_bot_url}/send_message"
        
        # --- Отправляем сообщение в каждый чат --- 
        sent_count = 0
        error_count = 0
        
        # Разбиваем сообщение на части, если оно длинное
        # Telegram API ограничивает длину сообщения примерно 4096 символами
        message_parts = self.split_message(message, max_length=4000)
        
        # Получаем HTTP клиент один раз
        try:
            async with httpx.AsyncClient() as client:
                for chat_id in chat_ids:
                    try:
                        # Убедимся, что chat_id это строка для payload
                        chat_id_str = str(chat_id)
                        
                        # Отправляем каждую часть сообщения последовательно
                        for i, part in enumerate(message_parts):
                            payload = {
                                "chat_id": chat_id_str,
                                "text": part,
                                "parse_mode": "HTML" # Или другой режим
                            }

                            # Добавляем кнопку подтверждения только к последней части сообщения
                            if requires_confirmation and i == len(message_parts) - 1:
                                # <<< ИЗМЕНЕНИЕ: Используем confirmation_type для префикса >>>
                                prefix = "confirm_eos:" if confirmation_type == 'end_of_shift' else "confirm:"
                                if not notification_id:
                                    logger.error(f"({self.TASK_TYPE}:{job_id}) Не найден notification_id для создания callback_data.")
                                else:
                                    callback_data = f"{prefix}{notification_id}"
                                    payload["reply_markup"] = {
                                        "inline_keyboard": [
                                            [
                                                {
                                                    "text": "Подтвердить ✅",
                                                    "callback_data": callback_data
                                                }
                                            ]
                                        ]
                                    }
                                    logger.info(f"({self.TASK_TYPE}:{job_id}) Добавлена кнопка подтверждения с callback_data: {callback_data}")

                            logger.info(f"({self.TASK_TYPE}:{job_id}) Отправка части {i+1}/{len(message_parts)} в чат {chat_id_str}...")
                            logger.debug(f"({self.TASK_TYPE}:{job_id}) Payload: {json.dumps(payload, ensure_ascii=False)}") # Логируем JSON

                            response = await client.post(send_endpoint, json=payload, timeout=10.0) # Таймаут на каждый запрос
                            
                            if response.status_code == 200:
                                logger.info(f"({self.TASK_TYPE}:{job_id}) -> Успешно отправлена часть {i+1}/{len(message_parts)} в чат {chat_id_str}.")
                                # Считаем успешной, если последняя часть отправлена
                                if i == len(message_parts) - 1:
                                    sent_count += 1
                            else:
                                logger.error(f"({self.TASK_TYPE}:{job_id}) -> Ошибка отправки части {i+1}/{len(message_parts)} в чат {chat_id_str}: {response.status_code}, {response.text}")
                                if i == len(message_parts) - 1:
                                    error_count += 1
                                break  # Прекращаем отправку частей при ошибке
                                
                            # Небольшая пауза между отправкой частей
                            await asyncio.sleep(0.3)

                        # <<< ИЗМЕНЕНИЕ: Планируем напоминание, если нужно >>>
                        if requires_confirmation and sent_count > 0:  # Только если хотя бы одно сообщение отправлено успешно
                            if task_manager:
                                # Время для первого напоминания - через 30 минут после этого уведомления
                                first_reminder_time = datetime.now(self.timezone) + timedelta(minutes=30) # ВОЗВРАЩЕНО НА 30 МИНУТ
                                # first_reminder_time = datetime.now(self.timezone) + timedelta(minutes=1) # Для теста

                                # --- ДОБАВЛЕНИЕ: Преобразование chat_id к короткому формату ПЕРЕД планированием ---
                                chat_id_long = chat_id # Сохраняем оригинальный ID (может быть int или str)
                                chat_id_str = str(chat_id_long)
                                logger.debug(f"Используем оригинальный chat_id {chat_id_str} для планирования напоминания")
                                # --- КОНЕЦ ДОБАВЛЕНИЯ ---
                                
                                # --- ИСПОЛЬЗУЕМ ОРИГИНАЛЬНЫЙ ID для ID задачи и данных ---
                                reminder_job_id = f"reminder:{notification_id}:{chat_id_str}" # Используем оригинальный ID
                                reminder_data = {
                                    'job_id': reminder_job_id,
                                    'chat_id': chat_id_str, # Передаем оригинальный строковый ID
                                    'notification_id': notification_id,
                                    'confirmation_type': confirmation_type,
                                    'run_time': first_reminder_time
                                }
                                # --- КОНЕЦ ИЗМЕНЕНИЯ ID ---
                                
                                # Получаем экземпляр задачи напоминания
                                reminder_task_instance = task_manager.task_instances.get(EventReminderTask.TASK_TYPE)
                                if reminder_task_instance:
                                    # <<< ИЗМЕНЕНИЕ: Логируем с оригинальным ID >>>
                                    logger.info(f"({self.TASK_TYPE}:{job_id}) Планирование задачи-напоминания {reminder_job_id} для чата {chat_id_str} на {first_reminder_time}")
                                    # Запускаем планирование напоминания (не ждем завершения)
                                    asyncio.create_task(reminder_task_instance.schedule(reminder_data))
                                else:
                                    logger.error(f"({self.TASK_TYPE}:{job_id}) Не найден экземпляр EventReminderTask в task_manager для планирования напоминания.")
                            else:
                                logger.error(f"({self.TASK_TYPE}:{job_id}) TaskManager не передан в kwargs, не могу запланировать напоминание.")
                        # <<< Конец планирования напоминания >>>

                    except Exception as send_err:
                        logger.error(f"({self.TASK_TYPE}:{job_id}) -> Ошибка при отправке в чат {chat_id}: {send_err}", exc_info=True)
                        error_count += 1
                        
                    # Небольшая пауза между запросами к разным чатам
                    await asyncio.sleep(0.5)
                
        except Exception as client_err:
             logger.error(f"({self.TASK_TYPE}:{job_id}) ❌ Ошибка при создании HTTP-клиента: {client_err}", exc_info=True)
             # Если клиент не создался, нет смысла продолжать
             error_count = len(chat_ids) # Считаем все ошибки
        finally:
            if client:
                await client.aclose()

        logger.info(f"({self.TASK_TYPE}:{job_id}) Завершение выполнения execute. Успешно отправлено: {sent_count}, Ошибок: {error_count}") 