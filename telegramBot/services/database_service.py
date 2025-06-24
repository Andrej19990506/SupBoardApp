import os
import logging
import json
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import traceback
import asyncpg

logger = logging.getLogger(__name__)

# Функция-помощник для преобразования asyncpg.Record в dict
# asyncpg возвращает объекты Record, а не dict по умолчанию
def _record_to_dict(record: asyncpg.Record) -> Optional[Dict]:
    return dict(record) if record else None

class DatabaseService:
    """Сервис для работы с базой данных PostgreSQL с использованием asyncpg"""
    
    # Конструктор теперь принимает пул соединений asyncpg
    def __init__(self, pool: asyncpg.Pool):
        """Инициализация сервиса с пулом соединений asyncpg"""
        self.pool = pool
        logger.info(f"✅ DatabaseService инициализирован с пулом соединений asyncpg")
    

    # === Асинхронные методы для работы с БД ===

    async def save_group(self, chat_id: str, chat_title: str, members: List[Dict], admins: List[Dict] = None) -> Optional[int]:
        """Асинхронно сохраняет группу и её участников в базе данных"""
        logger.info(f"=== [async] Начинаю сохранение группы {chat_title} (ID: {chat_id}) в базу данных ===")
        logger.info(f"Количество участников: {len(members)}")
        logger.info(f"Количество администраторов: {len(admins) if admins else 0}")

        try:
            group_chat_id_int = int(chat_id) # Преобразуем chat_id в int
        except (ValueError, TypeError):
             logger.error(f"[async] Некорректный chat_id '{chat_id}' для сохранения группы {chat_title}")
             return None

        async with self.pool.acquire() as conn:
            async with conn.transaction():
                try:
                    logger.info(f"[async] Выполняю запрос на сохранение/обновление группы")
                    group_db_id: Optional[int] = await conn.fetchval(
                        """
                        INSERT INTO groups (group_id, title, group_type, metadata)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (group_id) DO UPDATE SET
                            title = EXCLUDED.title,
                            group_type = EXCLUDED.group_type,
                            metadata = EXCLUDED.metadata
                        RETURNING id
                        """,
                        group_chat_id_int, # Передаем int
                        chat_title,
                        "",  # group_type теперь всегда пустая строка
                        json.dumps({ # Преобразуем dict в JSON строку
                            "total_members": len(members),
                            "total_admins": len(admins) if admins else 0,
                            "created_at": datetime.now().isoformat()
                        })
                    )
                    
                    if group_db_id is None:
                         logger.error(f"[async] Не удалось получить ID группы после INSERT/UPDATE для {chat_title}")
                         return None 
                    logger.info(f"[async] Группа сохранена с внутренним ID: {group_db_id}")
                    
                    # Сохраняем участников и связи с группой
                    for i, member in enumerate(members):
                        logger.info(f"[async] Обрабатываю участника {i+1}/{len(members)}: {member.get('username', member.get('user_id', 'Неизвестный'))}")
                        
                        # Преобразуем дату, если она есть
                        joined_at = None
                        if joined_date_str := member.get('joined_date'):
                            try:
                                joined_at = datetime.fromisoformat(joined_date_str)
                            except ValueError:
                                logger.warning(f"[async] Неверный формат даты '{joined_date_str}' для участника {member.get('user_id')}. Использую текущее время.")
                                joined_at = datetime.now()
                        else:
                            joined_at = datetime.now()

                        # --- ШАГ 1: Сохраняем/обновляем участника в 'members' и получаем member_db_id --- 
                        member_db_id: Optional[int] = await conn.fetchval(
                            """
                            INSERT INTO members (user_id, username, first_name, last_name, is_bot, photo_url, joined_at)
                            VALUES ($1, $2, '', '', $3, $4, $5) -- Имя и фамилия всегда пустые при INSERT
                            ON CONFLICT (user_id) DO UPDATE SET
                                username = EXCLUDED.username,
                                -- НЕ обновляем first_name и last_name при конфликте
                                is_bot = EXCLUDED.is_bot,
                                photo_url = COALESCE(EXCLUDED.photo_url, members.photo_url), 
                                joined_at = EXCLUDED.joined_at 
                            RETURNING id
                            """,
                            int(member['user_id']),      # $1: user_id
                            member.get('username'),    # $2: username
                            # Пустые first_name/last_name идут напрямую в VALUES
                            member.get('is_bot', False), # $3: is_bot
                            member.get('photo_url'),   # $4: photo_url
                            joined_at                  # $5: joined_at
                        )
                        
                        if member_db_id is None:
                             logger.error(f"[async] Не удалось получить ID участника после INSERT/UPDATE для user_id: {member.get('user_id')}")
                             continue # Пропускаем этого участника

                        logger.info(f"[async] Участник сохранен/обновлен в members с ID: {member_db_id}")

                        # --- ШАГ 2: Определяем роль участника --- 
                        role = 'member' 
                        member_status = member.get('status') 
                        if member_status == 'administrator':
                            role = 'administrator'
                        elif member_status == 'creator':
                            role = 'creator'
                        
                        logger.info(f"[async] Определенная роль для {member.get('user_id')}: {role}")
                        
                        # --- ШАГ 3: Сохраняем/обновляем связь в 'group_members', используя member_db_id --- 
                        await conn.execute(
                            """
                            INSERT INTO group_members (group_id, member_id, role) 
                            VALUES ($1, $2, $3)
                            ON CONFLICT (group_id, member_id) DO UPDATE SET 
                                role = EXCLUDED.role 
                            """,
                            group_db_id,
                            member_db_id, # Используем полученный ID
                            role 
                        )
                        logger.info(f"[async] Связь group_members сохранена/обновлена с ролью: {role}")

                    # Удаляем устаревшие связи group_members (если нужно)
                    # ... (можно добавить логику удаления, если участника больше нет в members) ...
                    
                    # Транзакция завершится успешно здесь (автоматический commit)
                    logger.info(f"✅ [async] Группа {chat_title} (тип: пустая строка) успешно сохранена в базе данных")
                    return group_db_id
                    
                except asyncpg.PostgresError as e: # Ловим ошибки asyncpg
                    logger.error(f"❌ [async] Ошибка PostgreSQL при сохранении группы {chat_title}: {e}")
                    logger.error(traceback.format_exc())
                    return None 
                except Exception as e:
                    logger.error(f"❌ [async] Неожиданная ошибка при сохранении группы {chat_title}: {e}")
                    logger.error(traceback.format_exc())
                    return None 
    
    async def get_group_data(self, chat_id: str) -> Optional[Dict]:
        """Асинхронно получает данные группы и её участников из базы данных"""
        try:
            group_chat_id_int = int(chat_id) # Преобразуем chat_id в int
        except (ValueError, TypeError):
             logger.error(f"[async] Некорректный chat_id '{chat_id}' для получения данных группы")
             return None

        try:
            async with self.pool.acquire() as conn:
                # Используем conn.fetchrow для получения одной строки
                # Запрос остается почти таким же, но используем $1
                # json_agg вместо array_agg для удобства работы с JSON
                record = await conn.fetchrow(
                    """
                    SELECT 
                        g.id as group_internal_id, 
                        g.group_id, 
                        g.title, 
                        g.group_type, 
                        g.metadata, 
                        COALESCE(json_agg(
                            json_build_object(
                                'id', m.id,
                                'user_id', m.user_id,
                                'username', m.username,
                                'first_name', m.first_name,
                                'last_name', m.last_name,
                                'status', m.status,
                                'is_bot', m.is_bot,
                                'photo_url', m.photo_url,
                                'joined_at', m.joined_at,
                                'is_senior_courier', m.is_senior_courier
                            ) ORDER BY m.first_name -- Опционально: сортируем участников
                        ) FILTER (WHERE m.id IS NOT NULL), '[]'::json) as members
                    FROM groups g
                    LEFT JOIN group_members gm ON g.id = gm.group_id
                    LEFT JOIN members m ON gm.member_id = m.id
                    WHERE g.group_id = $1 -- Ищем по внешнему group_id (chat_id)
                    GROUP BY g.id 
                    """,
                    group_chat_id_int # Передаем int
                )
                # Преобразуем asyncpg.Record в словарь
                group_data = _record_to_dict(record)
                # Преобразуем JSON строку metadata обратно в dict
                if group_data and isinstance(group_data.get('metadata'), str):
                     try:
                         group_data['metadata'] = json.loads(group_data['metadata'])
                     except json.JSONDecodeError:
                         logger.warning(f"Не удалось декодировать metadata JSON для группы {chat_id}")
                         group_data['metadata'] = {} # или оставить как есть

                return group_data

        except asyncpg.PostgresError as e:
            logger.error(f"❌ [async] Ошибка PostgreSQL при получении данных группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return None
        except Exception as e:
            logger.error(f"❌ [async] Неожиданная ошибка при получении данных группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return None

    async def get_groups_by_type(self, group_type: str) -> List[Dict]:
        """Асинхронно получает список групп определенного типа"""
        try:
            async with self.pool.acquire() as conn:
                # Используем conn.fetch для получения всех строк
                records = await conn.fetch(
                    """
                    SELECT id as group_internal_id, group_id, title, group_type, metadata 
                    FROM groups 
                    WHERE group_type = $1
                    """,
                    group_type
                )
                # Преобразуем список Record в список dict
                groups = [_record_to_dict(r) for r in records]
                
                # Преобразуем JSON строку metadata обратно в dict для каждого элемента
                for group in groups:
                     if group and isinstance(group.get('metadata'), str):
                         try:
                              group['metadata'] = json.loads(group['metadata'])
                         except json.JSONDecodeError:
                              logger.warning(f"Не удалось декодировать metadata JSON для группы {group.get('group_id')}")
                              group['metadata'] = {}

                return groups
        except asyncpg.PostgresError as e:
            logger.error(f"❌ [async] Ошибка PostgreSQL при получении списка групп типа {group_type}: {e}")
            logger.error(traceback.format_exc())
            return []
        except Exception as e:
            logger.error(f"❌ [async] Неожиданная ошибка при получении списка групп типа {group_type}: {e}")
            logger.error(traceback.format_exc())
            return []

    async def delete_group(self, chat_id: str) -> bool:
        """Асинхронно удаляет группу и её связи из базы данных"""
        try:
            group_chat_id_int = int(chat_id) # Преобразуем chat_id в int
        except (ValueError, TypeError):
             logger.error(f"[async] Некорректный chat_id '{chat_id}' для удаления группы")
             return False

        try:
            async with self.pool.acquire() as conn:
                async with conn.transaction(): # Используем транзакцию для атомарности
                    # Сначала получаем внутренний ID группы
                    group_db_id: Optional[int] = await conn.fetchval("SELECT id FROM groups WHERE group_id = $1", group_chat_id_int)

                    if not group_db_id:
                        logger.warning(f"[async] Группа {chat_id} не найдена для удаления.")
                        return False

                    # execute возвращает строку статуса, например "DELETE 1"
                    status = await conn.execute("DELETE FROM groups WHERE id = $1", group_db_id)
                    deleted = 'DELETE 1' in status # Проверяем, что одна строка удалена
                
                if deleted:
                    logger.info(f"✅ [async] Группа {chat_id} (внутренний ID: {group_db_id}) успешно удалена из базы данных")
                else:
                    # Эта ветка не должна сработать, если group_db_id был найден, но на всякий случай
                    logger.warning(f"[async] Не удалось удалить группу {chat_id}, хотя она была найдена.")
                return deleted
        except asyncpg.PostgresError as e:
            logger.error(f"❌ [async] Ошибка PostgreSQL при удалении группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False
        except Exception as e:
            logger.error(f"❌ [async] Неожиданная ошибка при удалении группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False

    async def remove_member_from_group(self, chat_id: str, user_id: Union[int, str]) -> bool:
        """Асинхронно удаляет участника из конкретной группы (удаляет связь)"""
        try:
             member_user_id = int(user_id)
             group_chat_id_int = int(chat_id) # Преобразуем chat_id в int
        except (ValueError, TypeError):
             logger.error(f"Некорректный user_id '{user_id}' или chat_id '{chat_id}' для удаления участника из группы")
             return False

        try:
            async with self.pool.acquire() as conn:
                 group_db_id: Optional[int] = await conn.fetchval("SELECT id FROM groups WHERE group_id = $1", group_chat_id_int) # Передаем int
                 member_db_id: Optional[int] = await conn.fetchval("SELECT id FROM members WHERE user_id = $1", member_user_id)

                 if not group_db_id:
                     logger.warning(f"[async] Группа {chat_id} не найдена для удаления участника {member_user_id}.")
                     return False
                 if not member_db_id:
                      logger.warning(f"[async] Участник {member_user_id} не найден для удаления из группы {chat_id}.")
                      # Возможно, его и так нет в группе, считаем это успехом? Зависит от логики.
                      # Пока вернем False, т.к. не нашли кого удалять.
                      return False 

                 # Удаляем связь
                 status = await conn.execute(
                      "DELETE FROM group_members WHERE group_id = $1 AND member_id = $2",
                      group_db_id, member_db_id
                 )
                 deleted = 'DELETE 1' in status
                 if deleted:
                      logger.info(f"✅ [async] Участник {member_user_id} удален из группы {chat_id}")
                      
                      # Проверяем, остался ли участник в других группах
                      remaining_groups = await conn.fetchrow(
                           "SELECT 1 FROM group_members WHERE member_id = $1 LIMIT 1", 
                           member_db_id
                      )
                      
                      if not remaining_groups:
                           # Если больше нигде не состоит, удаляем из таблицы members
                           member_delete_status = await conn.execute("DELETE FROM members WHERE id = $1", member_db_id)
                           if 'DELETE 1' in member_delete_status:
                                logger.info(f"✅ [async] Участник {member_user_id} (ID: {member_db_id}) полностью удален из таблицы members (не состоит больше ни в одной группе)")
                           else:
                                logger.warning(f"[async] Не удалось полностью удалить участника {member_user_id} (ID: {member_db_id}) из таблицы members")
                      else:
                           logger.info(f"[async] Участник {member_user_id} (ID: {member_db_id}) остается в таблице members (состоит в других группах)")
                           
                 else:
                      logger.warning(f"[async] Не удалось удалить участника {member_user_id} из группы {chat_id} (возможно, его там и не было).")
                 # Возвращаем True, если удалось удалить ИЗ ЭТОЙ ГРУППЫ
                 return deleted

        except asyncpg.PostgresError as e:
            logger.error(f"❌ [async] Ошибка PostgreSQL при удалении участника {member_user_id} из группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False
        except Exception as e:
            logger.error(f"❌ [async] Неожиданная ошибка при удалении участника {member_user_id} из группы {chat_id}: {e}")
            logger.error(traceback.format_exc())
            return False

    async def get_all_groups(self) -> List[Dict]:
        """Асинхронно получает список всех групп"""
        try:
            async with self.pool.acquire() as conn:
                records = await conn.fetch(
                     """
                     SELECT g.id as group_internal_id, g.group_id, g.title, g.group_type, g.metadata,
                            COALESCE(json_agg(
                                json_build_object(
                                    'id', m.id, 'user_id', m.user_id, 'username', m.username, 
                                    'first_name', m.first_name, 'last_name', m.last_name, 
                                    'status', m.status, 'is_bot', m.is_bot, 'photo_url', m.photo_url, 
                                    'joined_at', m.joined_at, 'is_senior_courier', m.is_senior_courier
                                ) ORDER BY m.first_name
                            ) FILTER (WHERE m.id IS NOT NULL), '[]'::json) as members
                     FROM groups g
                     LEFT JOIN group_members gm ON g.id = gm.group_id
                     LEFT JOIN members m ON gm.member_id = m.id
                     GROUP BY g.id
                     ORDER BY g.title -- Опционально сортируем группы по названию
                     """
                )
                groups = [_record_to_dict(r) for r in records]
                # Декодируем metadata
                for group in groups:
                     if group and isinstance(group.get('metadata'), str):
                         try:
                              group['metadata'] = json.loads(group['metadata'])
                         except json.JSONDecodeError:
                              group['metadata'] = {}

                return groups

        except asyncpg.PostgresError as e:
            logger.error(f"❌ [async] Ошибка PostgreSQL при получении всех групп: {e}")
            logger.error(traceback.format_exc())
            return []
        except Exception as e:
            logger.error(f"❌ [async] Неожиданная ошибка при получении всех групп: {e}")
            logger.error(traceback.format_exc())
            return []
            

    async def is_user_in_group(self, user_id: int, chat_id: str) -> bool:
        """
        Асинхронно проверяет, зарегистрирован ли пользователь (существует ли связь)
        в указанной группе.

        Args:
            user_id: ID пользователя Telegram.
            chat_id: Оригинальный ID чата Telegram (строка, например '-100...' или '-...').

        Returns:
            True, если пользователь найден в группе (связь существует), False в противном случае.
        """
        logger.debug(f"[async] Проверка наличия пользователя {user_id} в группе {chat_id}")
        
        try:
            # Преобразуем chat_id в int для поиска в таблице groups
            group_chat_id_int = int(chat_id) 
        except (ValueError, TypeError):
             logger.warning(f"[async] Некорректный chat_id '{chat_id}' для проверки is_user_in_group (user: {user_id})")
             return False # Некорректный ID группы - считаем, что не зарегистрирован
             
        # Преобразуем user_id в int (на всякий случай, если придет строка)
        try:
            user_id_int = int(user_id)
        except (ValueError, TypeError):
             logger.warning(f"[async] Некорректный user_id '{user_id}' для проверки is_user_in_group (group: {chat_id})")
             return False

        async with self.pool.acquire() as conn:
            try:
                # Запрос для проверки существования связи в group_members
                # через внешние ID пользователя и группы
                query = """
                    SELECT EXISTS (
                        SELECT 1
                        FROM group_members gm
                        JOIN members m ON gm.member_id = m.id
                        JOIN groups g ON gm.group_id = g.id
                        WHERE m.user_id = $1 AND g.group_id = $2
                    );
                """
                exists = await conn.fetchval(query, user_id_int, group_chat_id_int)
                logger.debug(f"[async] Результат проверки is_user_in_group ({user_id} в {chat_id}): {exists}")
                return bool(exists)
            
            except asyncpg.PostgresError as e:
                logger.error(f"❌ [async] Ошибка PostgreSQL при проверке is_user_in_group ({user_id} в {chat_id}): {e}")
                logger.error(traceback.format_exc())
                return False # В случае ошибки БД считаем, что не зарегистрирован
            except Exception as e:
                logger.error(f"❌ [async] Неожиданная ошибка при проверке is_user_in_group ({user_id} в {chat_id}): {e}")
                logger.error(traceback.format_exc())
                return False # В случае другой ошибки тоже считаем, что не зарегистрирован

    async def get_group_activation_password(self) -> str:
        """
        Возвращает актуальный пароль для активации бота из БД.
        Берёт последний (или единственный) пароль из таблицы group_activation_passwords.
        """
        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT password FROM group_activation_passwords ORDER BY id DESC LIMIT 1"
                )
                if row and 'password' in row:
                    return row['password']
                else:
                    logger.warning("Пароль для активации бота не найден в БД!")
                    return ""
        except Exception as e:
            logger.error(f"Ошибка при получении пароля активации из БД: {e}")
            return ""