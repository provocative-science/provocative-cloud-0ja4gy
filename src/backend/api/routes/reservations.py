"""
FastAPI router module for GPU reservation endpoints with integrated environmental monitoring.
Handles creation, management, and monitoring of GPU rental reservations with carbon capture metrics.
Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.reservation import (
    ReservationCreate, ReservationUpdate, ReservationResponse
)
from api.services.reservation_service import ReservationService
from api.dependencies import get_current_active_user, get_db_session
from api.utils.logger import get_logger

# Initialize router with prefix and tags
router = APIRouter(prefix='/api/v1/reservations', tags=['reservations'])

# Initialize logger
logger = get_logger(__name__)

@router.post('/', 
    response_model=ReservationResponse,
    status_code=status.HTTP_201_CREATED,
    description="Create a new GPU reservation with environmental impact tracking")
async def create_reservation(
    reservation_data: ReservationCreate,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
    reservation_service: ReservationService = Depends()
) -> ReservationResponse:
    """
    Creates a new GPU reservation with environmental impact assessment.
    
    Args:
        reservation_data: Validated reservation request data
        current_user: Authenticated user from JWT token
        db: Database session
        reservation_service: Reservation service instance
        
    Returns:
        ReservationResponse: Created reservation details with environmental metrics
        
    Raises:
        HTTPException: If reservation creation fails or validation errors occur
    """
    try:
        # Validate user permissions
        if not any(role in ['user', 'admin'] for role in current_user.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for GPU rental"
            )

        # Create reservation
        reservation = await reservation_service.create_reservation(
            reservation_data=reservation_data,
            user_id=current_user.id
        )

        logger.info(
            "Reservation created successfully",
            extra={
                "user_id": str(current_user.id),
                "gpu_id": str(reservation_data.gpu_id),
                "duration": reservation_data.duration_hours
            }
        )

        return reservation

    except ValueError as e:
        logger.error(
            "Reservation validation failed",
            extra={
                "error": str(e),
                "user_id": str(current_user.id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    except Exception as e:
        logger.error(
            "Reservation creation failed",
            extra={
                "error": str(e),
                "user_id": str(current_user.id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create reservation"
        )

@router.get('/{reservation_id}',
    response_model=ReservationResponse,
    description="Get reservation details with environmental metrics")
async def get_reservation(
    reservation_id: UUID,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
    reservation_service: ReservationService = Depends()
) -> ReservationResponse:
    """
    Retrieves reservation details including real-time environmental metrics.
    
    Args:
        reservation_id: UUID of the reservation
        current_user: Authenticated user from JWT token
        db: Database session
        reservation_service: Reservation service instance
        
    Returns:
        ReservationResponse: Reservation details with environmental data
        
    Raises:
        HTTPException: If reservation not found or access denied
    """
    try:
        # Get reservation with environmental metrics
        reservation = await reservation_service.get_reservation(reservation_id)
        
        # Verify user has access
        if str(reservation.user_id) != str(current_user.id) and 'admin' not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this reservation"
            )

        # Get environmental metrics
        env_metrics = await reservation_service.monitor_environmental_impact(reservation_id)
        reservation.environmental_metrics = env_metrics

        logger.info(
            "Reservation details retrieved",
            extra={
                "reservation_id": str(reservation_id),
                "user_id": str(current_user.id)
            }
        )

        return reservation

    except ValueError as e:
        logger.error(
            "Reservation retrieval failed",
            extra={
                "error": str(e),
                "reservation_id": str(reservation_id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found"
        )

    except Exception as e:
        logger.error(
            "Reservation retrieval error",
            extra={
                "error": str(e),
                "reservation_id": str(reservation_id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve reservation"
        )

@router.put('/{reservation_id}',
    response_model=ReservationResponse,
    description="Update reservation details with environmental impact reassessment")
async def update_reservation(
    reservation_id: UUID,
    update_data: ReservationUpdate,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
    reservation_service: ReservationService = Depends()
) -> ReservationResponse:
    """
    Updates reservation details with environmental impact reassessment.
    
    Args:
        reservation_id: UUID of the reservation
        update_data: Updated reservation data
        current_user: Authenticated user from JWT token
        db: Database session
        reservation_service: Reservation service instance
        
    Returns:
        ReservationResponse: Updated reservation details
        
    Raises:
        HTTPException: If update fails or validation errors occur
    """
    try:
        # Verify reservation ownership
        reservation = await reservation_service.get_reservation(reservation_id)
        if str(reservation.user_id) != str(current_user.id) and 'admin' not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this reservation"
            )

        # Update reservation
        updated = await reservation_service.update_reservation(
            reservation_id=reservation_id,
            update_data=update_data
        )

        logger.info(
            "Reservation updated successfully",
            extra={
                "reservation_id": str(reservation_id),
                "user_id": str(current_user.id)
            }
        )

        return updated

    except ValueError as e:
        logger.error(
            "Reservation update validation failed",
            extra={
                "error": str(e),
                "reservation_id": str(reservation_id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    except Exception as e:
        logger.error(
            "Reservation update failed",
            extra={
                "error": str(e),
                "reservation_id": str(reservation_id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update reservation"
        )

@router.delete('/{reservation_id}',
    status_code=status.HTTP_204_NO_CONTENT,
    description="Cancel reservation with environmental impact assessment")
async def cancel_reservation(
    reservation_id: UUID,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
    reservation_service: ReservationService = Depends()
) -> None:
    """
    Cancels an existing reservation with final environmental impact assessment.
    
    Args:
        reservation_id: UUID of the reservation
        current_user: Authenticated user from JWT token
        db: Database session
        reservation_service: Reservation service instance
        
    Raises:
        HTTPException: If cancellation fails or access denied
    """
    try:
        # Verify reservation ownership
        reservation = await reservation_service.get_reservation(reservation_id)
        if str(reservation.user_id) != str(current_user.id) and 'admin' not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this reservation"
            )

        # Cancel reservation
        await reservation_service.cancel_reservation(reservation_id)

        logger.info(
            "Reservation cancelled successfully",
            extra={
                "reservation_id": str(reservation_id),
                "user_id": str(current_user.id)
            }
        )

    except ValueError as e:
        logger.error(
            "Reservation cancellation failed",
            extra={
                "error": str(e),
                "reservation_id": str(reservation_id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    except Exception as e:
        logger.error(
            "Reservation cancellation error",
            extra={
                "error": str(e),
                "reservation_id": str(reservation_id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel reservation"
        )

@router.get('/',
    response_model=List[ReservationResponse],
    description="Get user's reservations with environmental metrics")
async def get_user_reservations(
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
    reservation_service: ReservationService = Depends()
) -> List[ReservationResponse]:
    """
    Retrieves all reservations for the current user with environmental metrics.
    
    Args:
        current_user: Authenticated user from JWT token
        db: Database session
        reservation_service: Reservation service instance
        
    Returns:
        List[ReservationResponse]: List of user's reservations with environmental data
        
    Raises:
        HTTPException: If retrieval fails
    """
    try:
        # Get user's reservations
        reservations = await reservation_service.get_user_reservations(current_user.id)

        # Add environmental metrics to each reservation
        for reservation in reservations:
            env_metrics = await reservation_service.monitor_environmental_impact(
                reservation.id
            )
            reservation.environmental_metrics = env_metrics

        logger.info(
            "User reservations retrieved",
            extra={
                "user_id": str(current_user.id),
                "count": len(reservations)
            }
        )

        return reservations

    except Exception as e:
        logger.error(
            "Failed to retrieve user reservations",
            extra={
                "error": str(e),
                "user_id": str(current_user.id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve reservations"
        )