"""
FastAPI dependency injection module for Provocative Cloud platform.
Provides reusable dependencies for authentication, database sessions, and service instances
with enhanced error handling, monitoring, and security features.
Version: 1.0.0
"""

import logging
from typing import AsyncGenerator, Optional
from datetime import datetime

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from cachetools import TTLCache

from .security.jwt import get_current_user
from ..db.session import get_session
from .services.user_service import UserService
from .utils.logger import get_logger

# Initialize components
db_manager = get_session()
service_cache = TTLCache(maxsize=100, ttl=300)  # 5 minute TTL
logger = get_logger(__name__, {"service": "dependencies"})

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Provides an async database session with enhanced connection pooling and monitoring.
    
    Returns:
        AsyncGenerator[AsyncSession, None]: Managed database session with automatic cleanup
        
    Raises:
        HTTPException: If database connection fails
    """
    try:
        session = await db_manager.__aenter__()
        
        # Log session creation
        logger.debug(
            "Database session created",
            extra={"session_id": str(id(session))}
        )
        
        try:
            yield session
        finally:
            # Ensure proper session cleanup
            await db_manager.__aexit__(None, None, None)
            logger.debug(
                "Database session closed",
                extra={"session_id": str(id(session))}
            )
            
    except Exception as e:
        logger.error(
            "Database session error",
            extra={"error": str(e)}
        )
        raise HTTPException(
            status_code=500,
            detail="Database connection error"
        )

async def get_current_active_user(
    session: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user)
) -> dict:
    """
    Enhanced user authentication with comprehensive validation and monitoring.
    
    Args:
        session: Database session
        current_user: JWT payload from token
        
    Returns:
        dict: Validated active user with role information
        
    Raises:
        HTTPException: If user validation fails
    """
    try:
        # Get user service
        user_service = await get_user_service(session)
        
        # Get user details
        user = await user_service.get_user(current_user.sub)
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
            
        # Validate user status
        if not user.is_active:
            raise HTTPException(
                status_code=403,
                detail="User account is inactive"
            )
            
        # Validate user roles
        if not user.roles:
            raise HTTPException(
                status_code=403,
                detail="User has no assigned roles"
            )
            
        # Update last login
        user.last_login = datetime.utcnow()
        session.add(user)
        await session.commit()
        
        logger.info(
            "User authenticated successfully",
            extra={
                "user_id": str(user.id),
                "roles": user.roles
            }
        )
        
        return user
        
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(
            "User authentication error",
            extra={"error": str(e)}
        )
        raise HTTPException(
            status_code=500,
            detail="Authentication error"
        )

async def get_user_service(
    session: AsyncSession = Depends(get_db_session)
) -> UserService:
    """
    Provides an enhanced user service instance with caching and monitoring.
    
    Args:
        session: Database session
        
    Returns:
        UserService: Configured service instance with caching
        
    Raises:
        HTTPException: If service initialization fails
    """
    try:
        # Check cache for existing service
        cache_key = f"user_service:{id(session)}"
        if cache_key in service_cache:
            return service_cache[cache_key]
            
        # Initialize new service instance
        service = UserService(session)
        
        # Validate service health
        if not await service.check_service_health():
            raise HTTPException(
                status_code=503,
                detail="User service unavailable"
            )
            
        # Cache service instance
        service_cache[cache_key] = service
        
        logger.debug(
            "User service initialized",
            extra={"session_id": str(id(session))}
        )
        
        return service
        
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(
            "User service initialization error",
            extra={"error": str(e)}
        )
        raise HTTPException(
            status_code=500,
            detail="Service initialization error"
        )