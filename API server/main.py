from fastapi import FastAPI, Request, status, Depends
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from models.base import Base
from core.config import settings
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
import redis.asyncio as redis


from api.v1.api import api_router as api_v1_router # Импортируем наш агрегатор V1
from core.logging_config import setup_logging
from db.session import get_db_session, async_engine

# Загрузка переменных окружения из .env файла
load_dotenv() 

# Настройка логирования
setup_logging()

# Создание таблиц в базе данных (если они еще не созданы)
async def create_tables():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables checked/created.")


redis_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Код, который выполняется при старте
    logger.info("Приложение запускается...")
    # Временно отключаем создание таблиц - используем Alembic
    # await create_tables()
    
    # ---> Инициализация Redis клиента < ---
    global redis_client
    redis_host = os.getenv("REDIS_HOST", "cache") # Имя сервиса из docker-compose
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    try:
        redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True) # decode_responses=True для строк
        await redis_client.ping() # Проверяем соединение
        logger.info(f"Успешное подключение к Redis/DragonflyDB по адресу {redis_host}:{redis_port}")
    except Exception as e:
        logger.error(f"Не удалось подключиться к Redis/DragonflyDB: {e}")
        redis_client = None # Устанавливаем в None, если не удалось подключиться
    # ---> Конец инициализации Redis < ---

    yield # Приложение работает

    logger.info("Приложение останавливается...")

    if redis_client:
        await redis_client.close()
        logger.info("Соединение с Redis/DragonflyDB закрыто.")


# ---> Создание экземпляра FastAPI с lifespan < ---
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# Добавляем настройки CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost", 
        "http://192.168.0.115:3000", 
        "http://192.168.0.115",
        "https://supboardapp.ru",
        "http://supboardapp.ru"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Добавляем middleware для доверия заголовкам прокси
@app.middleware("http")
async def trust_proxy_headers(request, call_next):
    # Всегда устанавливаем схему HTTPS для запросов от Cloudflare
    if "cf-connecting-ip" in request.headers:
        request.scope["scheme"] = "https"
    
    # Устанавливаем схему как HTTPS, если заголовок X-Forwarded-Proto указывает на это
    if "x-forwarded-proto" in request.headers:
        request.scope["scheme"] = request.headers["x-forwarded-proto"]
    
    # Также обрабатываем заголовок X-Forwarded-Ssl
    if "x-forwarded-ssl" in request.headers and request.headers["x-forwarded-ssl"].lower() == "on":
        request.scope["scheme"] = "https"
    
    # Продолжаем обработку запроса
    response = await call_next(request)
    return response

@app.get("/")
async def root():
    return {"message": "API server is running"}

@app.get("/api/")
async def api_root():
    return {"message": "API v1 is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Эндпоинт для проверки состояния API."""
    return {"status": "ok"}

# Подключаем роутер API v1 ПЕРЕД обработчиком preflight
app.include_router(api_v1_router, prefix=settings.API_V1_STR)

@app.options("/{full_path:path}")
async def preflight_handler(request: Request, full_path: str):
    """Обработчик preflight запросов для CORS"""
    return JSONResponse(content={}, headers={
        "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true"
    })

# Добавляем статические файлы для аватаров
app.mount("/static", StaticFiles(directory="data"), name="static")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        errors.append({
            "loc": error["loc"],
            "msg": error["msg"],
            "type": error["type"],
        })
    logger.error(f"Validation error for {request.url.path}: {errors}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors},
    )

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("FASTAPI_HOST", "127.0.0.1")
    port = int(os.getenv("FASTAPI_PORT", "8000")) 
    
    print(f"🚀 Starting FastAPI server on http://{host}:{port}")
    uvicorn.run(
        "main:app",
        host=host, 
        port=port, 
        reload=True
    ) 