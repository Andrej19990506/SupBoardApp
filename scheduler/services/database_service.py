import os
import logging
import json
import uuid
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timezone, timedelta
import traceback
import asyncpg

logger = logging.getLogger(__name__)

# Функция-помощник для преобразования asyncpg.Record в dict
def _record_to_dict(record: asyncpg.Record) -> Optional[Dict]:
    return dict(record) if record else None

# --- Функция-помощник для сериализации данных с UUID и datetime --- 
def _prepare_data_for_json(data: Any) -> Any:
    """
    Рекурсивно преобразует UUID и datetime в строки в данных 
    перед JSON-сериализацией.
    """
    if isinstance(data, dict):
        sanitized_data = {}
        for key, value in data.items():
            sanitized_data[key] = _prepare_data_for_json(value) # Рекурсивный вызов
        return sanitized_data
    elif isinstance(data, list):
        return [_prepare_data_for_json(item) for item in data] # Рекурсивный вызов для списков
    elif isinstance(data, uuid.UUID):
        return str(data)
    elif isinstance(data, datetime):
        # Преобразуем datetime в строку ISO 8601 (UTC)
        # Убедимся, что время aware перед конвертацией в UTC
        if data.tzinfo is None or data.tzinfo.utcoffset(data) is None:
            # Если naive, предполагаем локальное время и конвертируем в UTC (или просто isoformat?)
            # Безопаснее просто использовать isoformat, он добавит смещение если оно есть
             return data.isoformat()
        else:
            # Если aware, конвертируем в UTC и форматируем
            return data.astimezone(timezone.utc).isoformat()
    else:
        # Возвращаем другие типы как есть
        return data

class DatabaseService:
    """Сервис для работы с базой данных PostgreSQL для шедулера, использующий asyncpg"""
    
    def __init__(self, pool: asyncpg.Pool):
        """Инициализация сервиса с пулом соединений asyncpg"""
        self.pool = pool
        logger.info(f"✅ DatabaseService шедулера инициализирован с пулом соединений asyncpg")

    async def close_connection(self):
        """Закрывает пул соединений с базой данных"""
        # Фактическое закрытие происходит в lifespan, но метод оставлен для совместимости
        logger.info("DatabaseService: закрытие пула соединений не требуется (управляется в lifespan)")
        return True

    async def check_tables_exist(self) -> bool:
        """Проверяет существование необходимых таблиц"""
        try:
            async with self.pool.acquire() as conn:
                # Проверка наличия таблицы scheduler_tasks
                exists = await conn.fetchval(
                    """
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'scheduler_tasks'
                    );
                    """
                )
                
                if exists:
                    logger.info("✅ Таблица scheduler_tasks существует в PostgreSQL.")
                else:
                    logger.warning("⚠️ Таблица scheduler_tasks отсутствует в PostgreSQL! "
                                  "Убедитесь, что миграции Alembic были применены.")
                
                return exists
        except Exception as e:
            logger.error(f"❌ Ошибка при проверке таблиц: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    async def save_task(self, task_data: Dict[str, Any]) -> bool:
        """Сохраняет задачу в PostgreSQL таблицу scheduler_tasks (с адаптацией к существующей структуре)"""
        if not self.pool:
            logger.error("Пул соединений не инициализирован.")
            return False
            
        try:
            # Адаптируем данные под существующую структуру таблицы
            task_id = task_data.get('task_id')
            chat_id = task_data.get('chat_id') 
            task_type = task_data.get('task_type')
            next_run_time = task_data.get('next_run_time')
            data = task_data.get('data', {})
            
            if not task_id or not task_type or not next_run_time:
                logger.error(f"Недостаточно данных для сохранения задачи: {task_data}")
                return False
            
            # Создаем payload с метаданными
            payload = {
                'chat_id': chat_id,
                'task_type': task_type,
                'data': data
            }
            
            # Преобразуем next_run_time в datetime если это строка
            if isinstance(next_run_time, str):
                try:
                    next_run_time = datetime.fromisoformat(next_run_time.replace('Z', '+00:00'))
                except ValueError as e:
                    logger.error(f"Ошибка парсинга next_run_time: {e}")
                    return False
            
            # Убедимся, что время в UTC
            if next_run_time.tzinfo is None:
                next_run_time = next_run_time.replace(tzinfo=timezone.utc)
            elif next_run_time.tzinfo.utcoffset(next_run_time) != timedelta(0):
                next_run_time = next_run_time.astimezone(timezone.utc)

            async with self.pool.acquire() as conn:
                # Проверяем, существует ли задача
                exists = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM scheduler_tasks WHERE task_name = $1)",
                    task_id
                )
                
                if exists:
                    # Обновляем существующую задачу
                    await conn.execute(
                        """
                        UPDATE scheduler_tasks 
                        SET payload = $2, scheduled_for = $3, status = 'pending'
                        WHERE task_name = $1
                        """,
                        task_id, json.dumps(payload), next_run_time
                    )
                    logger.debug(f"Обновлена задача {task_id} в PostgreSQL")
                else:
                    # Создаем новую задачу
                    await conn.execute(
                        """
                        INSERT INTO scheduler_tasks (task_name, payload, scheduled_for, status)
                        VALUES ($1, $2, $3, 'pending')
                        """,
                        task_id, json.dumps(payload), next_run_time
                    )
                    logger.debug(f"Создана задача {task_id} в PostgreSQL")
                
                return True
        except Exception as e:
            logger.error(f"Ошибка при сохранении задачи в PostgreSQL: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    async def get_all_active_tasks(self) -> List[Dict[str, Any]]:
        """Получает все активные задачи из PostgreSQL (адаптировано к существующей структуре)"""
        if not self.pool:
            logger.error("Пул соединений не инициализирован.")
            return []
            
        try:
            async with self.pool.acquire() as conn:
                now_aware = datetime.now(timezone.utc)
                
                # Получаем задачи с scheduled_for >= текущего времени и status = 'pending'
                records = await conn.fetch(
                    """
                    SELECT task_name, payload, scheduled_for, status, created_at
                    FROM scheduler_tasks
                    WHERE scheduled_for >= $1 AND status = 'pending'
                    """,
                    now_aware
                )
                
                tasks = []
                for record in records:
                    try:
                        # Парсим payload
                        payload = json.loads(record['payload']) if record['payload'] else {}
                        
                        # Восстанавливаем структуру задачи
                        task = {
                            'task_id': record['task_name'],
                            'chat_id': payload.get('chat_id'),
                            'task_type': payload.get('task_type'),
                            'next_run_time': record['scheduled_for'].isoformat() if record['scheduled_for'] else None,
                            'data': payload.get('data', {}),
                            'status': record['status'],
                            'created_at': record['created_at'].isoformat() if record['created_at'] else None,
                            'updated_at': None  # В старой таблице нет updated_at
                        }
                        
                        tasks.append(task)
                        
                    except json.JSONDecodeError as e:
                        logger.error(f"Ошибка декодирования payload для задачи {record['task_name']}: {e}")
                        continue
                
                logger.debug(f"Получено {len(tasks)} активных задач из PostgreSQL")
                return tasks
                
        except Exception as e:
            logger.error(f"Ошибка при получении активных задач: {str(e)}")
            logger.error(traceback.format_exc())
            return []

    async def get_overdue_task_ids(self) -> List[str]:
        """Получает список ID просроченных задач из PostgreSQL (адаптировано к существующей структуре)."""
        overdue_task_ids = []
        try:
            async with self.pool.acquire() as conn:
                now_aware = datetime.now(timezone.utc)
                
                # Ищем задачи с scheduled_for < текущего времени и status = 'pending'
                records = await conn.fetch(
                    """
                    SELECT task_name 
                    FROM scheduler_tasks
                    WHERE scheduled_for < $1 AND status = 'pending'
                    """,
                    now_aware
                )
                
                overdue_task_ids = [record['task_name'] for record in records]
                logger.debug(f"Найдено {len(overdue_task_ids)} просроченных задач для удаления.")
                
        except Exception as e:
            logger.error(f"Ошибка при поиске просроченных задач: {str(e)}")
            logger.error(traceback.format_exc())
            # Возвращаем пустой список в случае ошибки, чтобы не удалить случайно что-то не то
            return [] 
            
        return overdue_task_ids

    async def delete_task(self, task_id: str) -> bool:
        """Удаляет задачу из PostgreSQL по ID (адаптировано к существующей структуре)"""
        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute("DELETE FROM scheduler_tasks WHERE task_name = $1", task_id)
                # Проверяем, была ли удалена строка
                deleted_count_str = result.split()[1] 
                if deleted_count_str == '0':
                    # Более точный лог
                    logger.warning(f"Задача {task_id} не найдена для удаления в БД (DELETE вернул 0).") 
                    return False
                
                logger.debug(f"Удалена задача с ID {task_id} из PostgreSQL")
                return True
        except Exception as e:
            logger.error(f"Ошибка при удалении задачи {task_id}: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    async def notify_websocket(self, channel: str, payload: Dict[str, Any]) -> bool:
        """Отправляет NOTIFY в указанный канал PostgreSQL для WebSocket сервиса"""
        # ... (код notify_websocket без изменений) ...

    async def notify_channel(self, channel: str, payload: Dict[str, Any]) -> bool:
        """Отправляет NOTIFY в указанный канал PostgreSQL.

        Args:
            channel: Имя канала PostgreSQL.
            payload: Словарь с данными для отправки (будет преобразован в JSON).

        Returns:
            True, если NOTIFY выполнен успешно, иначе False.
        """
        # Проверяем, что имя канала валидно (простая проверка)
        if not channel or not channel.isidentifier():
            logger.error(f"❌ Недопустимое имя канала для NOTIFY: '{channel}'")
            return False
            
        payload_json = "{}"
        try:
            # Преобразуем payload в JSON строку
            payload_json = json.dumps(payload).replace('\u0000', '') # Убираем нулевые байты

            # Проверка длины payload
            if len(payload_json.encode('utf-8')) >= 7999:
                logger.warning(f"Payload для NOTIFY канала '{channel}' слишком большой ({len(payload_json.encode('utf-8'))} байт), может быть обрезан PostgreSQL.")

            async with self.pool.acquire() as conn:
                # --- ИСПРАВЛЕНИЕ: Формируем строку NOTIFY с экранированным payload --- #
                # Экранируем одинарные кавычки в JSON-строке
                escaped_payload = payload_json.replace("'", "''")
                # Формируем SQL запрос, вставляя payload как строковый литерал
                sql_query = f"NOTIFY \"{channel}\", '{escaped_payload}'"
                # Выполняем запрос без параметров
                await conn.execute(sql_query)
                # -------------------------------------------------------------------- #
                logger.info(f"✅ NOTIFY отправлен в канал '{channel}' с payload: {payload_json[:200]}{'...' if len(payload_json) > 200 else ''}")
                return True
        except json.JSONDecodeError as json_err:
            logger.error(f"❌ Ошибка кодирования payload в JSON для NOTIFY канала '{channel}': {json_err}")
            return False
        except asyncpg.PostgresError as pg_err:
            logger.error(f"❌ Ошибка PostgreSQL при отправке NOTIFY в канал '{channel}': {pg_err}")
            return False
        except Exception as e:
            logger.error(f"❌ Неизвестная ошибка при отправке NOTIFY в канал '{channel}': {e}")
            logger.error(traceback.format_exc())
            return False

    async def get_task_by_id(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Получает данные задачи по ее ID из таблицы scheduler_tasks (адаптировано к существующей структуре)."""
        if not self.pool:
            logger.error("Пул соединений не инициализирован.")
            return None
        try:
            async with self.pool.acquire() as conn:
                query = "SELECT * FROM scheduler_tasks WHERE task_name = $1"
                row = await conn.fetchrow(query, task_id)
                if row:
                    logger.info(f"Задача {task_id} найдена в БД.")
                    
                    # Парсим payload
                    payload = json.loads(row['payload']) if row['payload'] else {}
                    
                    # Восстанавливаем структуру задачи
                    task_data = {
                        'task_id': row['task_name'],
                        'chat_id': payload.get('chat_id'),
                        'task_type': payload.get('task_type'),
                        'next_run_time': row['scheduled_for'],
                        'data': payload.get('data', {}),
                        'status': row['status'],
                        'created_at': row['created_at'],
                        'updated_at': None  # В старой таблице нет updated_at
                    }
                    
                    return task_data
                else:
                    logger.warning(f"Задача {task_id} не найдена в БД.")
                    return None
        except json.JSONDecodeError as e:
            logger.error(f"Ошибка декодирования payload для задачи {task_id}: {e}")
            return None
        except asyncpg.PostgresError as db_err:
            logger.error(f"Ошибка БД при получении задачи {task_id}: {db_err}")
            return None
        except Exception as e:
            logger.error(f"Неожиданная ошибка при получении задачи {task_id}: {e}", exc_info=True)
            return None

    async def update_task_next_run_time(self, task_id: str, next_run_time: datetime) -> bool:
        """Обновляет только scheduled_for для существующей задачи в БД (адаптировано к существующей структуре)."""
        if not self.pool:
            logger.error("Пул соединений не инициализирован для update_task_next_run_time.")
            return False
        
        if not next_run_time:
            logger.warning(f"Попытка обновить scheduled_for на None для задачи {task_id}. Пропуск.")
            return False # Не обновляем на None
            
        # Убедимся, что время aware и в UTC
        if next_run_time.tzinfo is None or next_run_time.tzinfo.utcoffset(next_run_time) is None:
            next_run_time = next_run_time.replace(tzinfo=timezone.utc)
        else:
            next_run_time = next_run_time.astimezone(timezone.utc)
        
        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute(
                    "UPDATE scheduler_tasks SET scheduled_for = $2 WHERE task_name = $1",
                    task_id, next_run_time
                )
                
                # Проверяем, была ли обновлена строка
                updated_count_str = result.split()[1]
                if updated_count_str == '0':
                    logger.warning(f"Задача {task_id} не найдена для обновления scheduled_for в БД.")
                    return False
                
                logger.debug(f"Обновлена scheduled_for для задачи {task_id} в PostgreSQL")
                return True
        except Exception as e:
            logger.error(f"Ошибка при обновлении scheduled_for для задачи {task_id}: {str(e)}")
            logger.error(traceback.format_exc())
            return False

    async def notify_channel(self, channel: str, payload: Dict[str, Any]) -> bool:
        # ... (код notify_channel) ...
        return False # Placeholder
