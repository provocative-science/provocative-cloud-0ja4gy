"""
Database package initialization module for the Provocative Cloud platform.
Provides centralized access to database components including session management,
base models, and initialization utilities.

This module serves as the main entry point for database operations,
exposing core database functionality while maintaining proper encapsulation.
"""

# SQLAlchemy v2.0.0+
from db.base import Base
from db.session import (
    engine,
    SessionLocal,
    get_session,
    init_db
)

# Re-export core database components for convenient access
__all__ = [
    'Base',          # SQLAlchemy declarative base class
    'engine',        # Configured async database engine
    'SessionLocal',  # Session factory for database connections
    'get_session',   # Async context manager for session handling
    'init_db'        # Database initialization function
]

# Version of SQLAlchemy being used
SQLALCHEMY_VERSION = "2.0.0"

# Module level docstring for package documentation
__doc__ = """
Provocative Cloud Database Package
--------------------------------

This package provides the core database functionality for the Provocative Cloud platform,
including:

- SQLAlchemy declarative base class with common model attributes
- Async database engine with optimized connection pooling
- Session management with proper transaction handling
- Database initialization and schema management utilities

Usage:
    from db import Base, get_session
    
    # Use Base for model definitions
    class User(Base):
        ...
    
    # Use session context manager for database operations
    async with get_session() as session:
        ...

The package ensures proper database connectivity, session handling, and model
base class availability throughout the application.
"""