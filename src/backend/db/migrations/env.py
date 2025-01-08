"""
Alembic migrations environment configuration for Provocative Cloud platform.
Handles both async and sync database schema migrations with enhanced transaction
management and connection pooling support.
"""

# SQLAlchemy v2.0+, Alembic v1.11+
import asyncio
import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool, engine_from_config
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from db.base import Base
from api.config import settings

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('alembic')

# Alembic Config object
config = context.config

# Interpret the config file for logging
fileConfig(config.config_file_name)

# Set SQLAlchemy MetaData object for Alembic
target_metadata = Base.metadata

# Get database settings with enhanced configuration
db_settings = settings.get_database_settings()

def get_url():
    """Get database URL with proper async driver."""
    url = str(settings.DATABASE_URL.get_secret_value())
    # Convert standard postgres:// URLs to postgresql+asyncpg:// for async support
    if url.startswith('postgres://'):
        return url.replace('postgres://', 'postgresql+asyncpg://', 1)
    return url

def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode for SQL script generation.
    
    This configures the context with just a URL and not an Engine,
    though an Engine is acceptable here as well.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        include_schemas=True,
        version_table_schema=target_metadata.schema,
        transaction_per_migration=True,
    )

    try:
        with context.begin_transaction():
            logger.info("Running offline migrations...")
            context.run_migrations()
            logger.info("Offline migrations completed successfully")
    except Exception as e:
        logger.error(f"Error during offline migrations: {str(e)}")
        raise

async def run_async_migrations(connection: AsyncEngine) -> None:
    """
    Execute migrations in async context with enhanced transaction management.
    
    Args:
        connection: AsyncEngine instance for database operations
    """
    try:
        # Configure the migration context
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            include_schemas=True,
            version_table_schema=target_metadata.schema,
            transaction_per_migration=True,
            user_module_prefix=None
        )

        logger.info("Starting async migrations...")
        async with connection.begin() as transaction:
            await connection.run_sync(context.run_migrations)
            logger.info("Async migrations completed successfully")
            await transaction.commit()
    except Exception as e:
        logger.error(f"Error during async migrations: {str(e)}")
        raise

def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode with async support and connection pooling.
    """
    # Create async engine with enhanced connection pooling
    connectable = create_async_engine(
        get_url(),
        poolclass=pool.QueuePool,
        pool_pre_ping=True,
        pool_size=db_settings['pool_size'],
        max_overflow=db_settings['max_overflow'],
        pool_timeout=db_settings['pool_timeout'],
        pool_recycle=db_settings['pool_recycle'],
        echo=False,
        # Configure SSL if in production
        connect_args=db_settings.get('ssl', {})
    )

    try:
        # Run migrations in async context
        asyncio.run(run_async_migrations(connectable))
    except Exception as e:
        logger.error(f"Error during online migrations: {str(e)}")
        raise
    finally:
        # Ensure engine is disposed properly
        asyncio.run(connectable.dispose())

if context.is_offline_mode():
    logger.info("Running migrations in offline mode")
    run_migrations_offline()
else:
    logger.info("Running migrations in online mode")
    run_migrations_online()