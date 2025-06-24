from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from core.config import settings


async_engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=False, # Поставим False по умолчанию
)

# Создаем фабрику асинхронных сессий
AsyncSessionFactory = sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False, # Важно для асинхронных сессий
    autocommit=False,
    autoflush=False,
)

async def get_db_session():
    """
    Функция-зависимость FastAPI для получения асинхронной сессии БД.
    Гарантирует закрытие сессии после использования.
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close() 