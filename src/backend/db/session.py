"""
Database session management module for the Provocative Cloud platform.
Provides SQLAlchemy async session factory and engine configuration with optimized
connection pooling, health checks, and transaction management.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession
)

from api.config import settings
from db.base import Base

# Configure module logger
logger = logging.getLogger(__name__)

# Create async engine with optimized connection pooling and health checks
engine = create_async_engine(
    settings.get_database_settings()['url'],
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_timeout=30,
    pool_pre_ping=True,  # Enable connection health checks
    echo=settings.DEBUG_MODE,
    pool_recycle=3600,  # Recycle connections hourly
    connect_args={
        'ssl': settings.get_database_settings()['ssl'],
        'server_settings': {
            'application_name': 'provocative_cloud',
            'statement_timeout': '60000',  # 60 second query timeout
            'idle_in_transaction_session_timeout': '60000'
        }
    }
)

# Configure async session factory with optimized settings
SessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Prevent expired object access issues
    autocommit=False,
    autoflush=False
)

@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager for safe database session handling with comprehensive
    error recovery and connection management.

    Yields:
        AsyncSession: Database session with configured transaction settings

    Raises:
        Exception: Re-raises any database errors after proper cleanup
    """
    session = SessionLocal()
    try:
        logger.debug("Creating new database session")
        await session.begin()  # Start explicit transaction
        yield session
        await session.commit()
        logger.debug("Successfully committed database transaction")
    except Exception as e:
        await session.rollback()
        logger.error(f"Database error occurred: {str(e)}", exc_info=True)
        raise  # Re-raise the exception after rollback
    finally:
        logger.debug("Cleaning up database session")
        await session.close()
        
async def init_db() -> None:
    """
    Initialize database schema, tables, indexes and constraints.
    Should be called during application startup.
    
    Raises:
        Exception: If database initialization fails
    """
    try:
        logger.info("Starting database initialization")
        
        # Import all models to register with Base
        from db import models  # noqa: F401
        
        async with engine.begin() as conn:
            # Create all tables, indexes and constraints
            await conn.run_sync(Base.metadata.create_all)
            
            # Verify schema creation
            tables = await conn.run_sync(
                lambda sync_conn: sync_conn.dialect.get_table_names(sync_conn)
            )
            logger.info(f"Created database tables: {', '.join(tables)}")
            
        logger.info("Successfully initialized database schema")
    except Exception as e:
        logger.error("Failed to initialize database", exc_info=True)
        raise RuntimeError(f"Database initialization failed: {str(e)}")