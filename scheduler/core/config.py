import os
from pydantic_settings import BaseSettings
from pathlib import Path
from dotenv import load_dotenv
from pydantic import Field, validator, AnyUrl
from typing import Optional, Any, Dict, List
import logging
import datetime
from zoneinfo import ZoneInfo
from urllib.parse import quote_plus

# Загружаем переменные окружения из файлов в правильном порядке
# В Docker контейнере будет загружен env.prod
for env_file in ['.env.prod', '.env.dev', '.env']:
    env_path = Path(env_file)
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break

class SchedulerSettings(BaseSettings):
    # --- Настройки базы данных ---
    POSTGRES_HOST: str = Field(..., validation_alias='POSTGRES_HOST')
    POSTGRES_PORT: int = Field(5432, validation_alias='POSTGRES_PORT')
    POSTGRES_DB: str = Field(..., validation_alias='POSTGRES_DB')
    POSTGRES_USER: str = Field(..., validation_alias='POSTGRES_USER')
    POSTGRES_PASSWORD: str = Field(..., validation_alias='POSTGRES_PASSWORD')

    # DATABASE_URL - будет автоматически собран из компонентов выше
    DATABASE_URL: Optional[str] = None

    # --- URL других сервисов ---
    API_URL: AnyUrl = Field(..., validation_alias='API_URL')
    BOT_URL: str = os.getenv("BOT_URL", "http://bot:8000")

    # --- Настройки планировщика ---
    TIMEZONE: str = Field("Asia/Krasnoyarsk", validation_alias='TIMEZONE')

    # <<< ДОБАВЛЕНИЕ: Настройки Redis/Dragonfly >>>
    REDIS_HOST: str = Field("cache", validation_alias='REDIS_HOST') # Используем имя сервиса из docker-compose
    REDIS_PORT: int = Field(6379, validation_alias='REDIS_PORT')
    REDIS_DB_SCHEDULER: int = Field(0, validation_alias='REDIS_DB_SCHEDULER') # БД для задач APScheduler
    REDIS_PASSWORD: Optional[str] = Field(None, validation_alias='REDIS_PASSWORD') # Если есть пароль
    # <<< КОНЕЦ ДОБАВЛЕНИЯ >>>

    # Настройки API Телеграм Бота (куда отправлять уведомления)
    BOT_API_URL: AnyUrl = Field(..., validation_alias='BOT_API_URL')

    # Настройки проверки доступности
    HEALTHCHECK_API_URL: AnyUrl = Field(..., validation_alias='HEALTHCHECK_API_URL')
    HEALTHCHECK_BOT_URL: AnyUrl = Field(..., validation_alias='HEALTHCHECK_BOT_URL')
    HEALTHCHECK_BOT_SEND_MESSAGE_URL: Optional[AnyUrl] = Field(None, validation_alias='HEALTHCHECK_BOT_SEND_MESSAGE_URL')
    HEALTHCHECK_INTERVAL_SECONDS: int = Field(default=60, env='HEALTHCHECK_INTERVAL_SECONDS')
    
    # Настройки вебсокета (если нужно)
    WEBSOCKET_URL: str = Field(default='ws://websocket:8002/ws', env='WEBSOCKET_URL')
    WEBSOCKET_CHANNEL: str = Field(default='websocket_channel', env='WEBSOCKET_CHANNEL')

    # --- Настройки логирования ---
    LOG_LEVEL: str = Field("INFO", validation_alias='LOG_LEVEL')

    @validator("DATABASE_URL", pre=True, always=True)
    def assemble_db_connection(cls, v: Optional[str], values: Dict[str, Any]) -> str:
        # Если DATABASE_URL уже задан в переменных окружения, используем его
        if isinstance(v, str) and v:
            return v
        
        # Иначе собираем из компонентов
        username = values.get("POSTGRES_USER", "")
        password = values.get("POSTGRES_PASSWORD", "")
        host = values.get("POSTGRES_HOST", "")
        port = values.get("POSTGRES_PORT", 5432)
        database = values.get("POSTGRES_DB", "")
        
        # Простая сборка URL без использования pydantic PostgresDsn
        # который имеет проблемы с парсингом сложных паролей
        dsn = f"postgresql+psycopg://{username}:{password}@{host}:{port}/{database}"
        
        return dsn

    @validator("API_URL", "BOT_API_URL", "HEALTHCHECK_API_URL", "HEALTHCHECK_BOT_URL", "HEALTHCHECK_BOT_SEND_MESSAGE_URL", pre=True)
    def url_to_string(cls, v: Any) -> str:
        if isinstance(v, AnyUrl):
            return str(v)
        return v

    class Config:
        case_sensitive = True
        # Указываем файлы окружения в порядке приоритета
        env_file = ('.env.prod', '.env.dev', '.env') 
        env_file_encoding = 'utf-8'
        extra = 'ignore' # Игнорировать лишние переменные в env

# Создаем экземпляр настроек для импорта в других модулях scheduler
scheduler_settings = SchedulerSettings()

# Логгирование для проверки загруженных настроек (опционально)
logger = logging.getLogger(__name__)
logger.info("="*80)
logger.info("🕐🕐🕐 ЧАСОВОЙ ПОЯС ШЕДУЛЕРА: {} 🕐🕐🕐".format(scheduler_settings.TIMEZONE))
local_time = datetime.datetime.now(ZoneInfo(scheduler_settings.TIMEZONE))
logger.info("🕐🕐🕐 ТЕКУЩЕЕ ВРЕМЯ В КРАСНОЯРСКЕ: {} 🕐🕐🕐".format(local_time.strftime("%Y-%m-%d %H:%M:%S %Z (UTC%z)")))
logger.info("="*80)

