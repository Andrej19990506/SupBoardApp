import logging
import os
import asyncio # Добавляем импорт asyncio
from contextlib import asynccontextmanager

# --- НАСТРОЙКА ЛОГИРОВАНИЯ --- 
# Переносим basicConfig как можно выше
# Настраиваем форматтер
log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
# Настраиваем обработчик (вывод в консоль)
log_handler = logging.StreamHandler()
log_handler.setFormatter(log_formatter)

# Настраиваем корневой логгер
logging.basicConfig(level=logging.INFO, handlers=[log_handler])

# Получаем и настраиваем кастомные логгеры
logger = logging.getLogger("SchedulerServiceAPI")
logger.setLevel(logging.INFO) # Явно ставим уровень
# Добавляем явную настройку для логгера Scheduler
scheduler_logger = logging.getLogger("Scheduler")
scheduler_logger.setLevel(logging.INFO)
# ----------------------------- 

# --- ДОБАВЛЕНИЕ DEBUG ЛОГИРОВАНИЯ ДЛЯ APSCHEDULER ---
apscheduler_logger = logging.getLogger("apscheduler")
apscheduler_logger.setLevel(logging.DEBUG)
# Добавим лог для подтверждения настройки
logger.info("✅ Логгер 'apscheduler' настроен на уровень DEBUG (использует корневой обработчик).") 
# -----------------------------------------------------

# Определяем окружение и логируем его
env = os.getenv('ENVIRONMENT', 'development')
if env == 'development':
    logger.info("🚀🚀🚀 ШЕДУЛЕР ЗАПУЩЕН В РЕЖИМЕ РАЗРАБОТКИ (DEV ENVIRONMENT) 🚀🚀🚀")
elif env == 'production':
    logger.info("🔴🔴🔴 ШЕДУЛЕР ЗАПУЩЕН В РЕЖИМЕ ПРОДАКШН (PRODUCTION ENVIRONMENT) 🔴🔴🔴")
    logger.info("🔴 API_URL: %s", os.getenv('API_URL', 'не указан'))
    logger.info("🔴 POSTGRES_HOST: %s", os.getenv('POSTGRES_HOST', 'не указан'))
else:
    logger.info(f"🚀 ШЕДУЛЕР ЗАПУЩЕН В РЕЖИМЕ: {env.upper()}")

try:
    import asyncpg
except ImportError:
    # Отлавливаем ошибку отсутствия библиотеки asyncpg
    logger.critical("""    ❌ ОШИБКА: Библиотека asyncpg не установлена!
    Выполните одно из следующих действий:
    1. Установите библиотеку вручную в контейнере:
       docker-compose exec scheduler pip install asyncpg
       docker-compose restart scheduler
    2. ИЛИ добавьте asyncpg в Dockerfile:
       RUN pip install asyncpg
    3. ИЛИ убедитесь, что 'asyncpg' добавлен в requirements.txt
       и затем пересоберите контейнер:
       docker-compose build --no-cache scheduler
       docker-compose up -d scheduler    """)
    raise

from fastapi import FastAPI, HTTPException

# Импорты (абсолютные пути)
from api_scheduler.schedule.routes import router as schedule_router
from api_scheduler.schedule.availability.routes import router as availability_router
from api_scheduler.schedule.notifications.routes import router as notification_router
from core.config import scheduler_settings
from scheduler import InventoryScheduler
from services.database_service import DatabaseService


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Инициализация сервиса и запуск шедулера...")
    
    # Инициализируем пул соединений с БД используя DATABASE_URL из настроек
    logger.info("🔍 Инициализация пула соединений с базой данных...")
    dsn = scheduler_settings.DATABASE_URL
    # Преобразуем схему для asyncpg (не поддерживает postgresql+psycopg)
    if dsn.startswith('postgresql+psycopg://'):
        dsn = dsn.replace('postgresql+psycopg://', 'postgresql://')
    elif dsn.startswith('postgresql+psycopg2://'):
        dsn = dsn.replace('postgresql+psycopg2://', 'postgresql://')
    elif dsn.startswith('postgres+psycopg://'):
        dsn = dsn.replace('postgres+psycopg://', 'postgresql://')
    
    db_pool = None
    try:
        db_pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=2,  # Минимальное количество соединений
            max_size=10, # Максимальное количество соединений
            timeout=30.0 # Таймаут соединения
        )
        
        # Инициализируем DatabaseService
        db_service = DatabaseService(pool=db_pool)
        app.state.db_service = db_service
        logger.info("✅ Подключение к базе данных успешно установлено!")
        
        # Проверяем наличие требуемых таблиц
        logger.info("🔍 Проверка наличия необходимых таблиц...")
        if not await db_service.check_tables_exist():
            logger.warning("⚠️ Необходимые таблицы отсутствуют. Проверьте миграции.")
        # Короткая проверка доступности API сервера без блокировки
        logger.info("🔌 Проверка доступности API сервера...")
        try:
            import requests
            api_url = scheduler_settings.API_URL
            base_api_url = str(api_url).rstrip('/')
            health_check_url = f"{base_api_url}/health"
            response = requests.get(health_check_url, timeout=1)
            if response.status_code == 200:
                logger.info(f"✅ API сервер доступен: {health_check_url}")
            else:
                logger.warning(f"⚠️ API сервер ({health_check_url}) вернул код {response.status_code}")
        except Exception as api_error:
            logger.warning(f"⚠️ API сервер ({scheduler_settings.API_URL}) недоступен: {api_error}")
        
        # --- Добавляем проверку доступности Telegram бота --- 
        logger.info("🔌 Проверка доступности Telegram бота...")
        telegram_bot_available = False
        try:
            import requests
            bot_url = "http://bot:8003" 
            bot_response = requests.get(f"{bot_url}/health", timeout=1)
            if bot_response.status_code == 200:
                telegram_bot_available = True
                logger.info(f"✅ Telegram бот доступен: {bot_url}")
                logger.info("🔌 🚀 🔌 ПРОВЕРКА ДОСТУПНОСТИ ЭНДПОИНТА ОТПРАВКИ СООБЩЕНИЙ БОТА... 🔌 🚀 🔌")
                try:
                    bot_send_message_health_url = f"{bot_url}/send_message/health"
                    logger.info(f"🔍 Проверка URL: {bot_send_message_health_url}")
                    
                    # Запрашиваем эндпоинт
                    send_message_response = requests.get(bot_send_message_health_url, timeout=2)
                    if send_message_response.status_code == 200:
                        logger.info(f"✅ ✅ ✅ ЭНДПОИНТ ОТПРАВКИ СООБЩЕНИЙ БОТА ДОСТУПЕН: {bot_send_message_health_url}")
                        
                        # Явно устанавливаем URL в переменную окружения
                        os.environ["HEALTHCHECK_BOT_SEND_MESSAGE_URL"] = bot_send_message_health_url
                        
                        if hasattr(scheduler_settings, 'HEALTHCHECK_BOT_SEND_MESSAGE_URL'):
                            scheduler_settings.HEALTHCHECK_BOT_SEND_MESSAGE_URL = bot_send_message_health_url
                        else:
                            setattr(scheduler_settings, 'HEALTHCHECK_BOT_SEND_MESSAGE_URL', bot_send_message_health_url)
                            logger.info(f"✅ Динамически добавлен атрибут HEALTHCHECK_BOT_SEND_MESSAGE_URL в настройки со значением: {bot_send_message_health_url}")
                            
                        # Проверяем, что атрибут успешно добавлен
                        if hasattr(scheduler_settings, 'HEALTHCHECK_BOT_SEND_MESSAGE_URL'):
                            logger.info(f"✅ Проверка: HEALTHCHECK_BOT_SEND_MESSAGE_URL = {scheduler_settings.HEALTHCHECK_BOT_SEND_MESSAGE_URL}")
                        else:
                            logger.warning("⚠️ Не удалось добавить атрибут HEALTHCHECK_BOT_SEND_MESSAGE_URL в настройки")
                    else:
                        logger.warning(f"⚠️ ⚠️ ⚠️ ЭНДПОИНТ ОТПРАВКИ СООБЩЕНИЙ БОТА вернул код {send_message_response.status_code}: {bot_send_message_health_url}")
                except Exception as send_message_error:
                    logger.warning(f"⚠️ ⚠️ ⚠️ ЭНДПОИНТ ОТПРАВКИ СООБЩЕНИЙ БОТА НЕДОСТУПЕН: {send_message_error}")
            else:
                logger.warning(f"⚠️ Telegram бот вернул код {bot_response.status_code}: {bot_url}")
        except Exception as bot_api_error:
            logger.warning(f"⚠️ Telegram бот недоступен: {bot_api_error}")
        # -----------------------------------------------------
        
        scheduler_instance = InventoryScheduler(settings=scheduler_settings, db_service=db_service)
        app.state.scheduler_instance = scheduler_instance
        
        try:
            scheduler_instance.start()
            logger.info("✅ Шедулер успешно запущен.")
            logger.info("🔄 Запуск фоновой загрузки активных задач...")
            asyncio.create_task(scheduler_instance.reload_scheduled_tasks())
            logger.info("✅ Загрузка задач запущена в фоне, сервер продолжает запуск")
            
            # Запускаем автоматизацию статусов бронирований
            logger.info("🤖 Запуск автоматизации статусов бронирований...")
            try:
                await scheduler_instance.task_manager.schedule_booking_status_automation()
                logger.info("✅ Автоматизация статусов бронирований запущена")
            except Exception as automation_error:
                logger.error(f"❌ Ошибка запуска автоматизации статусов: {automation_error}")
            
            yield
        except Exception as e:
            logger.critical(f"❌ Критическая ошибка при инициализации шедулера: {e}")
            # Перевыбрасываем исключение, чтобы FastAPI понял, что запуск не удался
            raise HTTPException(status_code=500, detail=f"Ошибка инициализации шедулера: {str(e)}")
    except Exception as e:
        logger.critical(f"❌ Критическая ошибка при инициализации: {e}")
        # Перевыбрасываем исключение, чтобы FastAPI понял, что запуск не удался
        raise HTTPException(status_code=500, detail=f"Ошибка инициализации: {str(e)}")
    finally:
        # Останавливаем шедулер, если он был создан и запущен
        if hasattr(app.state, 'scheduler_instance') and app.state.scheduler_instance and app.state.scheduler_instance.is_running():
            logger.info("👋 Остановка шедулера...")
            app.state.scheduler_instance.stop()
            logger.info("✅ Шедулер остановлен.")
            
        # Закрываем пул соединений при завершении
        if db_pool:
            logger.info("🔍 Закрытие пула соединений...")
            await db_pool.close()
            logger.info("✅ Пул соединений закрыт.")

# Создаем FastAPI приложение с lifespan
app = FastAPI(
    title="Scheduler Service API",
    description="API для управления задачами шедулера (FastAPI).",
    version="1.0.0",
    lifespan=lifespan
)

# Подключаем роутеры
app.include_router(schedule_router, prefix="/scheduler")
app.include_router(availability_router, prefix="/scheduler")
app.include_router(notification_router, prefix="/scheduler/notifications", tags=["Notifications"])
