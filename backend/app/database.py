import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


# Lightweight column migrations — add columns that don't exist yet.
# This avoids needing a full DB reset for additive schema changes.
_COLUMN_MIGRATIONS = [
    ("school_onboarding_profiles", "amendments", "jsonb"),
]


async def _run_column_migrations(conn):
    """Add any missing columns to existing tables."""
    for table, column, col_type in _COLUMN_MIGRATIONS:
        try:
            await conn.execute(text(
                f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_type}"
            ))
            logger.info("Migration: ensured %s.%s exists", table, column)
        except Exception:
            logger.debug("Migration: %s.%s skipped (table may not exist yet)", table, column)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _run_column_migrations(conn)
