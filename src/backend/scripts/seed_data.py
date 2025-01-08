"""
Database seeding script for Provocative Cloud platform.
Populates development and staging environments with initial test data including
GPU servers, GPU resources, and sample metrics with comprehensive validation.
"""

import asyncio
import logging
from decimal import Decimal
from typing import Dict, List, Optional
import uuid
from datetime import datetime

from pydantic import BaseModel, validator

from db.models.gpu import GPU
from db.models.server import Server
from db.session import SessionLocal

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Environment-specific configuration
ENV_SPECIFIC_CONFIG = {
    'development': {
        'validate_data': True,
        'enable_metrics': True,
        'cleanup_existing': True
    },
    'staging': {
        'validate_data': True,
        'enable_metrics': True,
        'cleanup_existing': False
    }
}

# Sample server data
SAMPLE_SERVERS = [
    {
        'hostname': 'gpu-01.provocative.cloud',
        'ip_address': '10.0.1.10',
        'specs': {
            'cpu': {
                'model': 'AMD EPYC 7763',
                'cores': 64,
                'threads': 128
            },
            'memory': {
                'total_gb': 512,
                'type': 'DDR4-3200'
            },
            'storage': {
                'type': 'NVMe SSD',
                'capacity_gb': 2048
            },
            'network': {
                'bandwidth_gbps': 100,
                'interfaces': ['eth0', 'eth1']
            }
        },
        'maintenance_mode': False
    }
]

# Sample GPU data
SAMPLE_GPUS = [
    {
        'model': 'NVIDIA A100',
        'vram_gb': 80,
        'price_per_hour': '4.50',
        'metrics': {
            'temperature': 35,
            'utilization': 0,
            'memory_used': 0,
            'power_draw': 250
        }
    },
    {
        'model': 'NVIDIA V100',
        'vram_gb': 32,
        'price_per_hour': '2.75',
        'metrics': {
            'temperature': 32,
            'utilization': 0,
            'memory_used': 0,
            'power_draw': 200
        }
    }
]

class EnvironmentConfig(BaseModel):
    """Validation model for environment configuration."""
    validate_data: bool
    enable_metrics: bool
    cleanup_existing: bool

    @validator('validate_data', 'enable_metrics', 'cleanup_existing')
    def validate_boolean(cls, v: bool) -> bool:
        if not isinstance(v, bool):
            raise ValueError("Configuration values must be boolean")
        return v

async def validate_environment(env_name: str) -> Dict:
    """
    Validate and load environment-specific configuration.
    
    Args:
        env_name: Target environment name
        
    Returns:
        Dict: Validated environment configuration
        
    Raises:
        ValueError: If environment name is invalid
    """
    if env_name not in ENV_SPECIFIC_CONFIG:
        raise ValueError(f"Invalid environment: {env_name}")
    
    config = ENV_SPECIFIC_CONFIG[env_name]
    return EnvironmentConfig(**config).dict()

async def create_sample_servers(session: SessionLocal, env_config: Dict) -> List[Server]:
    """
    Create sample server instances with validation.
    
    Args:
        session: Database session
        env_config: Environment configuration
        
    Returns:
        List[Server]: Created server instances
    """
    servers = []
    
    if env_config['cleanup_existing']:
        await session.execute(Server.__table__.delete())
        logger.info("Cleaned up existing servers")
    
    for server_data in SAMPLE_SERVERS:
        try:
            server = Server(
                hostname=server_data['hostname'],
                ip_address=server_data['ip_address'],
                specs=server_data['specs']
            )
            session.add(server)
            servers.append(server)
            logger.info(f"Created server: {server.hostname}")
        except Exception as e:
            logger.error(f"Failed to create server {server_data['hostname']}: {str(e)}")
            raise
    
    await session.flush()
    return servers

async def create_sample_gpus(
    session: SessionLocal,
    servers: List[Server],
    env_config: Dict
) -> List[GPU]:
    """
    Create sample GPU resources and assign to servers.
    
    Args:
        session: Database session
        servers: List of available servers
        env_config: Environment configuration
        
    Returns:
        List[GPU]: Created GPU instances
    """
    gpus = []
    
    if env_config['cleanup_existing']:
        await session.execute(GPU.__table__.delete())
        logger.info("Cleaned up existing GPUs")
    
    for idx, gpu_data in enumerate(SAMPLE_GPUS):
        try:
            # Round-robin assignment to servers
            server = servers[idx % len(servers)]
            
            gpu = GPU(
                server_id=str(server.id),
                model=gpu_data['model'],
                vram_gb=gpu_data['vram_gb'],
                price_per_hour=Decimal(gpu_data['price_per_hour'])
            )
            
            if env_config['enable_metrics']:
                gpu.metrics = gpu_data['metrics']
            
            session.add(gpu)
            gpus.append(gpu)
            logger.info(f"Created GPU: {gpu.model} on server {server.hostname}")
        except Exception as e:
            logger.error(f"Failed to create GPU {gpu_data['model']}: {str(e)}")
            raise
    
    await session.flush()
    return gpus

async def main(env_name: str) -> None:
    """
    Main entry point for seeding the database.
    
    Args:
        env_name: Target environment name
    """
    try:
        # Validate environment configuration
        env_config = await validate_environment(env_name)
        logger.info(f"Starting data seeding for environment: {env_name}")
        
        async with SessionLocal() as session:
            async with session.begin():
                # Create servers
                servers = await create_sample_servers(session, env_config)
                logger.info(f"Created {len(servers)} servers")
                
                # Create GPUs and assign to servers
                gpus = await create_sample_gpus(session, servers, env_config)
                logger.info(f"Created {len(gpus)} GPUs")
                
                await session.commit()
                logger.info("Successfully committed all changes")
                
    except Exception as e:
        logger.error(f"Seeding failed: {str(e)}", exc_info=True)
        raise
    else:
        logger.info("Data seeding completed successfully")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python seed_data.py <environment>")
        sys.exit(1)
    
    env_name = sys.argv[1]
    asyncio.run(main(env_name))