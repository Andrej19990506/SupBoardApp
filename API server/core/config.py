import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional

# --- Загружаем переменные окружения ---
env_path = Path('.') / '.env' 
load_dotenv(dotenv_path=env_path)

def format_pem_key(key_value: str) -> str:
    """
    Форматирует PEM ключ, добавляя переносы строк если их нет
    """
    if not key_value:
        return ""
    
    # Декодируем экранированные символы \n в реальные переносы строк
    if '\\n' in key_value:
        key_value = key_value.replace('\\n', '\n')
    
    # Если ключ уже содержит переносы строк, возвращаем как есть
    if '\n' in key_value:
        return key_value
    
    # Если это приватный ключ без заголовков
    if not key_value.startswith('-----'):
        return f"-----BEGIN PRIVATE KEY-----\n{key_value}\n-----END PRIVATE KEY-----"
    
    # Если ключ в одну строку с заголовками, добавляем переносы
    if key_value.startswith('-----BEGIN PRIVATE KEY-----'):
        # Разделяем ключ на части
        parts = key_value.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').strip()
        # Разбиваем на строки по 64 символа
        lines = [parts[i:i+64] for i in range(0, len(parts), 64)]
        return f"-----BEGIN PRIVATE KEY-----\n{chr(10).join(lines)}\n-----END PRIVATE KEY-----"
    
    if key_value.startswith('-----BEGIN PUBLIC KEY-----'):
        # Разделяем ключ на части
        parts = key_value.replace('-----BEGIN PUBLIC KEY-----', '').replace('-----END PUBLIC KEY-----', '').strip()
        # Разбиваем на строки по 64 символа
        lines = [parts[i:i+64] for i in range(0, len(parts), 64)]
        return f"-----BEGIN PUBLIC KEY-----\n{chr(10).join(lines)}\n-----END PUBLIC KEY-----"
    
    return key_value

class Settings(BaseSettings):
    # --- Настройки базы данных ---
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "postgres")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", 5432))
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "appsubboard")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")

    # Собираем URL для асинхронного драйвера asyncpg
    DATABASE_URL: str = (
        f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@"
        f"{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    )

    # --- Настройки FastAPI ---
    API_V1_STR: str = "/api/v1" 
    PROJECT_NAME: str = "AppSubboard API"
    PROJECT_VERSION: str = "0.1.0"

    # --- Настройки JWT ---
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

    # --- Настройки Push-уведомлений ---
    _vapid_public_key_raw: str = os.getenv("VAPID_PUBLIC_KEY", "")
    _vapid_private_key_raw: str = os.getenv("VAPID_PRIVATE_KEY", "")
    
    @property
    def VAPID_PUBLIC_KEY(self) -> str:
        return format_pem_key(self._vapid_public_key_raw)
    
    @property
    def VAPID_PRIVATE_KEY(self) -> str:
        return format_pem_key(self._vapid_private_key_raw)
    
    VAPID_CLAIMS_SUB: str = os.getenv("VAPID_CLAIMS_SUB", "mailto:admin@example.com")
    APPLICATION_SERVER_KEY: str = os.getenv("APPLICATION_SERVER_KEY", "")

    # --- Настройки SMS.ru ---
    SMS_RU_API_ID: str = os.getenv("SMS_RU_API_ID", "")

    # --- Настройки Google OAuth ---
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

    class Config:
        case_sensitive = True


# Создаем экземпляр настроек для импорта в других модулях
settings = Settings()

def get_settings() -> Settings:
    """Функция для получения настроек (для dependency injection)"""
    return settings 