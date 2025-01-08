"""
Alembic migrations package initialization for Provocative Cloud platform.
Provides package-level imports and configuration for database schema migrations
with transaction support and error handling.

Version: 1.0.0
"""

# alembic v1.11.0+
from alembic import command, util
from migrations.env import run_migrations_offline, run_migrations_online

# Package version
__version__ = '1.0.0'

# Export migration runners for CLI usage
__all__ = ['run_migrations_offline', 'run_migrations_online']

# Configure logging for migration operations
import logging
logger = logging.getLogger('alembic.migrations')

def handle_migration_error(func):
    """
    Decorator for handling migration errors with proper logging and rollback.
    
    Args:
        func: Migration function to wrap
        
    Returns:
        Wrapped function with error handling
    """
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except util.CommandError as e:
            logger.error(f"Migration command error: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected migration error: {str(e)}")
            raise
    return wrapper

# Apply error handling to migration runners
run_migrations_offline = handle_migration_error(run_migrations_offline)
run_migrations_online = handle_migration_error(run_migrations_online)

def get_migration_context():
    """
    Returns the current migration context with configuration.
    
    Returns:
        dict: Migration context information
    """
    return {
        'offline_enabled': True,
        'transaction_per_migration': True,
        'version': __version__,
        'supports_async': True
    }

def verify_migration_environment():
    """
    Verifies that the migration environment is properly configured.
    
    Raises:
        RuntimeError: If migration environment is not properly configured
    """
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        
        # Verify alembic.ini exists
        config = Config()
        script = ScriptDirectory.from_config(config)
        
        # Verify migrations directory structure
        if not script.dir.exists():
            raise RuntimeError("Migrations directory not found")
            
        # Verify env.py exists
        if not (script.dir / 'env.py').exists():
            raise RuntimeError("env.py not found in migrations directory")
            
        logger.info("Migration environment verified successfully")
    except Exception as e:
        logger.error(f"Migration environment verification failed: {str(e)}")
        raise RuntimeError("Invalid migration environment") from e

# Initialize package
try:
    verify_migration_environment()
except Exception as e:
    logger.warning(f"Migration environment verification failed: {str(e)}")
    logger.warning("Migrations may not work correctly until environment is fixed")