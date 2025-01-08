"""
Service layer for GPU resource management, handling business logic for GPU allocation,
monitoring, environmental impact tracking, and cooling system optimization in the
Provocative Cloud platform.
"""

import asyncio
import logging
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session
from prometheus_client import Counter, Gauge, Histogram
from carbon_metrics import CarbonMetrics

from api.schemas.gpu import GPUBase
from db.models.gpu import GPU
from gpu_manager.manager import GPUManager

# Configure logging
logger = logging.getLogger(__name__)

# Global constants
METRICS_COLLECTION_INTERVAL = 60  # seconds
COOLING_OPTIMIZATION_INTERVAL = 300  # seconds

# Prometheus metrics
gpu_allocation_counter = Counter(
    'gpu_allocations_total',
    'Total number of GPU allocations',
    ['gpu_id']
)

gpu_utilization_gauge = Gauge(
    'gpu_utilization_percent',
    'GPU utilization percentage',
    ['gpu_id']
)

cooling_efficiency_gauge = Gauge(
    'gpu_cooling_efficiency',
    'GPU cooling system efficiency',
    ['gpu_id']
)

carbon_impact_gauge = Gauge(
    'gpu_carbon_impact_kg',
    'GPU carbon impact in kg CO2',
    ['gpu_id']
)

class GPUService:
    """
    Service class handling GPU resource management business logic with environmental
    impact tracking and cooling system optimization.
    """

    def __init__(self, db_session: Session, gpu_manager: GPUManager, carbon_metrics: CarbonMetrics):
        """
        Initialize GPU service with database session, GPU manager, and carbon metrics tracking.

        Args:
            db_session: SQLAlchemy database session
            gpu_manager: GPU resource manager instance
            carbon_metrics: Carbon metrics tracking instance
        """
        self._db = db_session
        self._gpu_manager = gpu_manager
        self._carbon_metrics = carbon_metrics
        self._logger = logger

        # Initialize background tasks
        self._metrics_task = None
        self._cooling_task = None
        asyncio.create_task(self._start_background_tasks())

    async def _start_background_tasks(self):
        """Initialize background tasks for metrics collection and cooling optimization."""
        self._metrics_task = asyncio.create_task(self._collect_metrics())
        self._cooling_task = asyncio.create_task(self._optimize_cooling())

    async def _collect_metrics(self):
        """Background task for continuous GPU metrics collection."""
        while True:
            try:
                gpus = self._db.query(GPU).filter(GPU.is_available == True).all()
                for gpu in gpus:
                    metrics = await self._gpu_manager.get_metrics(gpu.id)
                    gpu.update_metrics(metrics)
                    
                    # Update Prometheus metrics
                    gpu_utilization_gauge.labels(gpu_id=str(gpu.id)).set(
                        metrics['utilization']['gpu']
                    )
                    carbon_impact_gauge.labels(gpu_id=str(gpu.id)).set(
                        metrics['environmental']['carbon_efficiency']
                    )
                
                self._db.commit()
                await asyncio.sleep(METRICS_COLLECTION_INTERVAL)
            except Exception as e:
                self._logger.error(f"Metrics collection failed: {str(e)}")
                await asyncio.sleep(5)

    async def _optimize_cooling(self):
        """Background task for continuous cooling system optimization."""
        while True:
            try:
                gpus = self._db.query(GPU).all()
                for gpu in gpus:
                    optimization_result = await self._gpu_manager.optimize_cooling(gpu.id)
                    
                    # Update cooling efficiency metrics
                    cooling_efficiency_gauge.labels(gpu_id=str(gpu.id)).set(
                        optimization_result['cooling_efficiency']
                    )
                    
                    if optimization_result['optimization_applied']:
                        self._logger.info(
                            f"Cooling optimization applied for GPU {gpu.id}: "
                            f"Efficiency: {optimization_result['cooling_efficiency']:.2f}"
                        )
                
                await asyncio.sleep(COOLING_OPTIMIZATION_INTERVAL)
            except Exception as e:
                self._logger.error(f"Cooling optimization failed: {str(e)}")
                await asyncio.sleep(5)

    async def get_available_gpus(self) -> List[Dict]:
        """
        Retrieve list of available GPU resources with environmental metrics.

        Returns:
            List[Dict]: Available GPUs with specifications and environmental data
        """
        try:
            # Query available GPUs
            gpus = self._db.query(GPU).filter(
                GPU.is_available == True
            ).all()

            gpu_list = []
            for gpu in gpus:
                # Get current metrics
                metrics = await self._gpu_manager.get_metrics(gpu.id)
                
                # Get environmental impact data
                env_metrics = await self._gpu_manager.monitor_environmental_impact()
                gpu_env_metrics = env_metrics.get(str(gpu.id), {})
                
                gpu_data = gpu.to_dict()
                gpu_data.update({
                    'current_metrics': metrics,
                    'environmental_metrics': {
                        'power_efficiency': gpu_env_metrics.get('power_efficiency', 0),
                        'thermal_efficiency': gpu_env_metrics.get('thermal_efficiency', 0),
                        'carbon_efficiency': gpu_env_metrics.get('carbon_efficiency', 0),
                        'cooling_status': await self._gpu_manager.optimize_cooling(gpu.id)
                    }
                })
                gpu_list.append(gpu_data)

            return gpu_list
        except Exception as e:
            self._logger.error(f"Failed to get available GPUs: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to retrieve GPU list")

    async def allocate_gpu(self, reservation_id: UUID, requirements: Dict) -> Dict:
        """
        Allocate GPU resources for a workload with cooling optimization.

        Args:
            reservation_id: Unique reservation identifier
            requirements: GPU requirements specification

        Returns:
            Dict: Allocation details including access credentials and environmental metrics
        """
        try:
            # Validate reservation exists
            gpu = self._db.query(GPU).filter(
                GPU.id == requirements['gpu_id'],
                GPU.is_available == True
            ).first()
            
            if not gpu:
                raise HTTPException(status_code=404, detail="GPU not available")

            # Optimize cooling before allocation
            cooling_status = await self._gpu_manager.optimize_cooling(gpu.id)
            
            # Allocate GPU
            allocation = await self._gpu_manager.allocate_gpu(
                gpu.id,
                requirements.get('compute_requirements', {})
            )
            
            # Update GPU status
            gpu.is_available = False
            gpu_allocation_counter.labels(gpu_id=str(gpu.id)).inc()
            
            # Get environmental metrics
            env_metrics = await self._gpu_manager.monitor_environmental_impact()
            gpu_env_metrics = env_metrics.get(str(gpu.id), {})
            
            self._db.commit()

            return {
                'allocation_id': str(reservation_id),
                'gpu_id': str(gpu.id),
                'access_credentials': allocation['credentials'],
                'environmental_metrics': {
                    'power_efficiency': gpu_env_metrics.get('power_efficiency', 0),
                    'thermal_efficiency': gpu_env_metrics.get('thermal_efficiency', 0),
                    'carbon_efficiency': gpu_env_metrics.get('carbon_efficiency', 0),
                    'cooling_status': cooling_status
                }
            }
        except Exception as e:
            self._logger.error(f"GPU allocation failed: {str(e)}")
            self._db.rollback()
            raise HTTPException(status_code=500, detail="Failed to allocate GPU")

    async def release_gpu(self, reservation_id: UUID) -> Dict:
        """
        Release allocated GPU resources and update environmental metrics.

        Args:
            reservation_id: Reservation identifier to release

        Returns:
            Dict: Release status with environmental impact summary
        """
        try:
            # Get GPU from reservation
            gpu = self._db.query(GPU).join(GPU.reservations).filter(
                GPU.reservations.any(id=reservation_id)
            ).first()
            
            if not gpu:
                raise HTTPException(status_code=404, detail="Reservation not found")

            # Get final environmental metrics
            env_metrics = await self._gpu_manager.monitor_environmental_impact()
            gpu_env_metrics = env_metrics.get(str(gpu.id), {})
            
            # Release GPU resources
            await self._gpu_manager.release_gpu(gpu.id)
            
            # Update GPU status
            gpu.is_available = True
            self._db.commit()

            return {
                'gpu_id': str(gpu.id),
                'release_status': 'success',
                'environmental_impact': {
                    'power_efficiency': gpu_env_metrics.get('power_efficiency', 0),
                    'thermal_efficiency': gpu_env_metrics.get('thermal_efficiency', 0),
                    'carbon_efficiency': gpu_env_metrics.get('carbon_efficiency', 0),
                    'total_carbon_captured': gpu_env_metrics.get('carbon_captured', 0)
                }
            }
        except Exception as e:
            self._logger.error(f"GPU release failed: {str(e)}")
            self._db.rollback()
            raise HTTPException(status_code=500, detail="Failed to release GPU")

    async def get_gpu_metrics(self, gpu_id: UUID) -> Dict:
        """
        Get current metrics for a GPU including environmental data.

        Args:
            gpu_id: GPU identifier

        Returns:
            Dict: Current GPU metrics including hardware and environmental data
        """
        try:
            gpu = self._db.query(GPU).filter(GPU.id == gpu_id).first()
            if not gpu:
                raise HTTPException(status_code=404, detail="GPU not found")

            # Get current metrics
            metrics = await self._gpu_manager.get_metrics(gpu_id)
            
            # Get environmental metrics
            env_metrics = await self._gpu_manager.monitor_environmental_impact()
            gpu_env_metrics = env_metrics.get(str(gpu_id), {})
            
            # Get cooling status
            cooling_status = await self._gpu_manager.optimize_cooling(gpu_id)

            return {
                'gpu_id': str(gpu_id),
                'hardware_metrics': metrics,
                'environmental_metrics': {
                    'power_efficiency': gpu_env_metrics.get('power_efficiency', 0),
                    'thermal_efficiency': gpu_env_metrics.get('thermal_efficiency', 0),
                    'carbon_efficiency': gpu_env_metrics.get('carbon_efficiency', 0),
                    'cooling_status': cooling_status
                }
            }
        except Exception as e:
            self._logger.error(f"Failed to get GPU metrics: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to retrieve GPU metrics")

    async def optimize_cooling(self) -> Dict:
        """
        Optimize cooling system parameters based on GPU load.

        Returns:
            Dict: Optimization results and efficiency metrics
        """
        try:
            optimization_results = {}
            gpus = self._db.query(GPU).all()
            
            for gpu in gpus:
                # Get current metrics
                metrics = await self._gpu_manager.get_metrics(gpu.id)
                
                # Optimize cooling
                cooling_result = await self._gpu_manager.optimize_cooling(gpu.id)
                
                # Update cooling efficiency metrics
                cooling_efficiency_gauge.labels(gpu_id=str(gpu.id)).set(
                    cooling_result['cooling_efficiency']
                )
                
                optimization_results[str(gpu.id)] = {
                    'temperature': metrics['temperature'],
                    'power_usage': metrics['power']['current'],
                    'cooling_efficiency': cooling_result['cooling_efficiency'],
                    'optimization_applied': cooling_result['optimization_applied']
                }

            return {
                'timestamp': asyncio.get_event_loop().time(),
                'optimization_results': optimization_results
            }
        except Exception as e:
            self._logger.error(f"Cooling optimization failed: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to optimize cooling system")