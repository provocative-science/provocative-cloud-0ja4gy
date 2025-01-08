"""
Docker container management module for Provocative Cloud platform.
Handles GPU-enabled container operations with integrated environmental impact tracking.
"""

import asyncio
import logging
from typing import Dict, Optional
import time

import docker  # version: 6.1.0
from pydantic import BaseModel, Field  # version: 2.0+
import carbon_metrics  # version: 1.0.0

from gpu_manager.manager import GPUManager

# Configure logging
logger = logging.getLogger(__name__)

# Global constants
DEFAULT_CONTAINER_LABELS = {
    'platform': 'provocative-cloud',
    'managed-by': 'infrastructure',
    'monitored': 'true'
}

CONTAINER_STATES = {
    'RUNNING': 'running',
    'STOPPED': 'exited',
    'PAUSED': 'paused',
    'ERROR': 'error'
}

ENVIRONMENTAL_THRESHOLDS = {
    'MAX_TEMPERATURE_CELSIUS': 75,
    'MAX_POWER_WATTS': 300,
    'COOLING_EFFICIENCY_TARGET': 0.85
}

class ContainerConfig(BaseModel):
    """Validation model for container configuration."""
    name: str
    image: str
    gpu_requirements: Dict = Field(default_factory=dict)
    environment: Dict = Field(default_factory=dict)
    cooling_preferences: Dict = Field(default_factory=dict)

class DockerManager:
    """
    Manages Docker container operations with GPU support and environmental impact monitoring.
    """
    
    def __init__(self, gpu_manager: GPUManager):
        """
        Initialize Docker manager with required components.
        
        Args:
            gpu_manager: GPU resource manager instance
        """
        self.client = docker.from_env()
        self.gpu_manager = gpu_manager
        self.active_containers: Dict = {}
        self.environmental_metrics: Dict = {}
        
        # Verify Docker Engine version
        version = self.client.version()
        if not version['Version'] >= '24.0.0':
            raise RuntimeError("Docker Engine 24.0+ required")
            
        # Verify NVIDIA Container Toolkit
        if not self._verify_nvidia_toolkit():
            raise RuntimeError("NVIDIA Container Toolkit not found")
            
        logger.info("Docker manager initialized with environmental monitoring")

    def _verify_nvidia_toolkit(self) -> bool:
        """Verifies NVIDIA Container Toolkit installation."""
        try:
            runtime_list = self.client.info().get('Runtimes', {})
            return 'nvidia' in runtime_list
        except Exception as e:
            logger.error(f"Failed to verify NVIDIA toolkit: {str(e)}")
            return False

    async def create_container(
        self,
        name: str,
        image: str,
        gpu_requirements: Dict,
        environment: Dict,
        cooling_preferences: Dict
    ) -> Dict:
        """
        Creates a new Docker container with GPU support and environmental monitoring.
        
        Args:
            name: Container name
            image: Docker image name
            gpu_requirements: GPU resource requirements
            environment: Environment variables
            cooling_preferences: Cooling system preferences
            
        Returns:
            Dict containing container details and environmental metrics
        """
        try:
            # Validate configuration
            config = ContainerConfig(
                name=name,
                image=image,
                gpu_requirements=gpu_requirements,
                environment=environment,
                cooling_preferences=cooling_preferences
            )
            
            # Calculate initial environmental impact
            env_metrics = await self.gpu_manager.monitor_environmental_impact()
            current_efficiency = env_metrics.get('carbon_efficiency', 0)
            
            if current_efficiency < ENVIRONMENTAL_THRESHOLDS['COOLING_EFFICIENCY_TARGET']:
                logger.warning(f"Suboptimal cooling efficiency: {current_efficiency:.2f}")
                
            # Allocate GPU with environmental constraints
            gpu_allocation = await self.gpu_manager.allocate_gpu(
                gpu_requirements,
                cooling_preferences.get('max_temperature', ENVIRONMENTAL_THRESHOLDS['MAX_TEMPERATURE_CELSIUS'])
            )
            
            # Prepare container configuration
            container_config = {
                'name': name,
                'image': image,
                'environment': environment,
                'runtime': 'nvidia',
                'device_requests': [{
                    'Driver': 'nvidia',
                    'Count': gpu_requirements.get('count', 1),
                    'Capabilities': [['gpu', 'utility', 'compute']]
                }],
                'labels': {
                    **DEFAULT_CONTAINER_LABELS,
                    'gpu-id': str(gpu_allocation['gpu_id']),
                    'power-limit': str(gpu_allocation['power_limit'])
                }
            }
            
            # Pull image if needed
            try:
                self.client.images.get(image)
            except docker.errors.ImageNotFound:
                logger.info(f"Pulling image: {image}")
                self.client.images.pull(image)
            
            # Create and start container
            container = self.client.containers.create(**container_config)
            container.start()
            
            # Initialize environmental metrics collection
            self.environmental_metrics[container.id] = {
                'start_time': time.time(),
                'gpu_id': gpu_allocation['gpu_id'],
                'initial_efficiency': current_efficiency,
                'power_limit': gpu_allocation['power_limit']
            }
            
            # Track active container
            self.active_containers[container.id] = {
                'container': container,
                'gpu_allocation': gpu_allocation,
                'cooling_preferences': cooling_preferences
            }
            
            logger.info(f"Container {name} created with GPU {gpu_allocation['gpu_id']}")
            
            return {
                'container_id': container.id,
                'gpu_id': gpu_allocation['gpu_id'],
                'environmental_metrics': {
                    'cooling_efficiency': current_efficiency,
                    'power_limit_watts': gpu_allocation['power_limit'],
                    'temperature_celsius': env_metrics.get('temperature', 0)
                }
            }
            
        except Exception as e:
            logger.error(f"Container creation failed: {str(e)}")
            raise

    async def stop_container(self, container_id: str) -> Dict:
        """
        Stops and removes a container with environmental impact tracking.
        
        Args:
            container_id: Container identifier
            
        Returns:
            Dict containing operation status and environmental impact
        """
        try:
            if container_id not in self.active_containers:
                raise ValueError(f"Container {container_id} not found")
                
            container_info = self.active_containers[container_id]
            container = container_info['container']
            gpu_allocation = container_info['gpu_allocation']
            
            # Collect final environmental metrics
            final_metrics = await self.gpu_manager.get_environmental_metrics()
            runtime_hours = (time.time() - self.environmental_metrics[container_id]['start_time']) / 3600
            
            # Stop container
            container.stop(timeout=30)
            
            # Release GPU resources
            await self.gpu_manager.release_gpu(gpu_allocation['gpu_id'])
            
            # Calculate environmental impact
            power_usage = final_metrics.get('power_usage', 0)
            carbon_impact = carbon_metrics.calculate_impact(
                power_watts=power_usage,
                runtime_hours=runtime_hours,
                cooling_efficiency=final_metrics.get('cooling_efficiency', 0)
            )
            
            # Remove container
            container.remove()
            
            # Update tracking
            final_env_metrics = self.environmental_metrics.pop(container_id)
            self.active_containers.pop(container_id)
            
            logger.info(f"Container {container_id} stopped and removed")
            
            return {
                'status': 'success',
                'runtime_hours': runtime_hours,
                'environmental_impact': {
                    'power_usage_kwh': power_usage * runtime_hours / 1000,
                    'carbon_impact_kg': carbon_impact,
                    'cooling_efficiency_avg': final_metrics.get('cooling_efficiency', 0),
                    'initial_efficiency': final_env_metrics['initial_efficiency']
                }
            }
            
        except Exception as e:
            logger.error(f"Container stop failed: {str(e)}")
            raise

    async def get_container_metrics(self, container_id: str) -> Dict:
        """
        Retrieves container metrics including environmental impact.
        
        Args:
            container_id: Container identifier
            
        Returns:
            Dict containing container metrics and environmental impact
        """
        try:
            if container_id not in self.active_containers:
                raise ValueError(f"Container {container_id} not found")
                
            container_info = self.active_containers[container_id]
            container = container_info['container']
            gpu_id = container_info['gpu_allocation']['gpu_id']
            
            # Get container stats
            stats = container.stats(stream=False)
            
            # Get GPU metrics
            gpu_metrics = await self.gpu_manager.get_gpu_metrics(gpu_id)
            
            # Get environmental metrics
            env_metrics = await self.gpu_manager.get_environmental_metrics()
            
            return {
                'container': {
                    'cpu_usage': stats['cpu_stats']['cpu_usage']['total_usage'],
                    'memory_usage': stats['memory_stats']['usage'],
                    'network_io': stats['networks']
                },
                'gpu': {
                    'utilization': gpu_metrics['utilization'],
                    'memory': gpu_metrics['memory'],
                    'power': gpu_metrics['power']
                },
                'environmental': {
                    'temperature_celsius': env_metrics['temperature'],
                    'cooling_efficiency': env_metrics['cooling_efficiency'],
                    'power_usage_watts': env_metrics['power_usage'],
                    'carbon_efficiency': env_metrics['carbon_efficiency']
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get container metrics: {str(e)}")
            raise

    async def optimize_container_resources(self, container_id: str) -> Dict:
        """
        Optimizes container resource allocation based on environmental impact.
        
        Args:
            container_id: Container identifier
            
        Returns:
            Dict containing optimization results
        """
        try:
            if container_id not in self.active_containers:
                raise ValueError(f"Container {container_id} not found")
                
            container_info = self.active_containers[container_id]
            gpu_id = container_info['gpu_allocation']['gpu_id']
            
            # Get current metrics
            current_metrics = await self.get_container_metrics(container_id)
            current_efficiency = current_metrics['environmental']['cooling_efficiency']
            
            # Optimize if efficiency is below target
            if current_efficiency < ENVIRONMENTAL_THRESHOLDS['COOLING_EFFICIENCY_TARGET']:
                # Calculate new power limit
                current_power = current_metrics['gpu']['power']['current']
                new_power_limit = int(current_power * (
                    ENVIRONMENTAL_THRESHOLDS['COOLING_EFFICIENCY_TARGET'] / current_efficiency
                ))
                new_power_limit = min(
                    new_power_limit,
                    ENVIRONMENTAL_THRESHOLDS['MAX_POWER_WATTS']
                )
                
                # Apply optimization
                await self.gpu_manager.optimize_cooling(gpu_id)
                
                # Update container tracking
                container_info['gpu_allocation']['power_limit'] = new_power_limit
                
                return {
                    'optimization_applied': True,
                    'power_limit_adjusted': True,
                    'previous_power_limit': current_power,
                    'new_power_limit': new_power_limit,
                    'efficiency_improvement': (
                        ENVIRONMENTAL_THRESHOLDS['COOLING_EFFICIENCY_TARGET'] - current_efficiency
                    )
                }
            
            return {
                'optimization_applied': False,
                'current_efficiency': current_efficiency,
                'message': 'Current efficiency meets target'
            }
            
        except Exception as e:
            logger.error(f"Resource optimization failed: {str(e)}")
            raise