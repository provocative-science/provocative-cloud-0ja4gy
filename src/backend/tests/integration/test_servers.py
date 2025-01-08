"""
Integration tests for server management functionality in the Provocative Cloud platform.
Tests server CRUD operations, maintenance mode, metrics collection, and environmental impact monitoring.
"""

import pytest
from datetime import datetime
from uuid import UUID

from httpx import AsyncClient
from sqlalchemy.orm import Session

from app import app
from db.models.server import Server
from api.schemas.server import ServerCreate, ServerUpdate

# Test data constants
VALID_SERVER_DATA = {
    "hostname": "gpu-test-01",
    "ip_address": "192.168.1.100",
    "specs": {
        "cpu": {
            "model": "AMD EPYC 7742",
            "cores": 64,
            "threads": 128
        },
        "memory": {
            "total_gb": 512,
            "type": "DDR4-3200"
        },
        "storage": {
            "type": "NVMe",
            "capacity_gb": 2000
        },
        "network": {
            "bandwidth_gbps": 100,
            "interfaces": ["eth0", "eth1"]
        }
    },
    "environmental_specs": {
        "cooling_system": {
            "type": "liquid",
            "capacity": 50000,
            "efficiency": 0.92
        },
        "carbon_capture_unit": {
            "capacity": 100,
            "efficiency": 0.85,
            "maintenance_schedule": "weekly"
        }
    }
}

@pytest.mark.asyncio
async def test_create_server(client: AsyncClient, admin_token: dict):
    """Test server creation with environmental metrics setup."""
    try:
        response = await client.post(
            "/api/v1/servers",
            json=VALID_SERVER_DATA,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Validate server creation
        assert data["hostname"] == VALID_SERVER_DATA["hostname"]
        assert data["ip_address"] == VALID_SERVER_DATA["ip_address"]
        assert isinstance(data["id"], str)
        
        # Validate environmental specs
        assert "environmental_metrics" in data
        assert "cooling_system" in data["environmental_metrics"]
        assert "carbon_capture_unit" in data["environmental_metrics"]
        assert data["environmental_metrics"]["cooling_system"]["efficiency"] > 0.8
        
    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")

@pytest.mark.asyncio
async def test_get_server(client: AsyncClient, admin_token: dict, test_server: Server):
    """Test retrieving server details with environmental metrics."""
    try:
        response = await client.get(
            f"/api/v1/servers/{test_server.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate server data
        assert data["id"] == str(test_server.id)
        assert data["hostname"] == test_server.hostname
        
        # Validate environmental metrics
        assert "environmental_metrics" in data
        assert "pue_ratio" in data["environmental_metrics"]
        assert "carbon_capture_rate" in data["environmental_metrics"]
        assert "water_usage_effectiveness" in data["environmental_metrics"]
        
    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")

@pytest.mark.asyncio
async def test_update_server(client: AsyncClient, admin_token: dict, test_server: Server):
    """Test updating server configuration including environmental settings."""
    update_data = {
        "specs": {
            "cooling_system": {
                "efficiency": 0.95,
                "maintenance_schedule": "monthly"
            }
        },
        "environmental_metrics": {
            "pue_ratio": 1.2,
            "carbon_capture_rate": 0.6
        }
    }
    
    try:
        response = await client.put(
            f"/api/v1/servers/{test_server.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate updates
        assert data["specs"]["cooling_system"]["efficiency"] == 0.95
        assert data["environmental_metrics"]["pue_ratio"] == 1.2
        assert data["environmental_metrics"]["carbon_capture_rate"] == 0.6
        
    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")

@pytest.mark.asyncio
async def test_server_metrics_collection(
    client: AsyncClient,
    host_token: dict,
    test_server: Server,
    mock_environmental_metrics: dict
):
    """Test comprehensive server metrics collection including environmental data."""
    try:
        response = await client.get(
            f"/api/v1/servers/{test_server.id}/metrics",
            headers={"Authorization": f"Bearer {host_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate system metrics
        assert "system_metrics" in data
        assert "cpu_usage_percent" in data["system_metrics"]
        assert "memory_usage_percent" in data["system_metrics"]
        assert "network_bandwidth_mbps" in data["system_metrics"]
        
        # Validate environmental metrics
        assert "environmental_metrics" in data
        assert "pue_ratio" in data["environmental_metrics"]
        assert "carbon_capture_rate" in data["environmental_metrics"]
        assert "water_usage_effectiveness" in data["environmental_metrics"]
        assert "cooling_efficiency" in data["environmental_metrics"]
        
        # Validate metrics ranges
        assert 0 <= data["environmental_metrics"]["pue_ratio"] <= 2.0
        assert 0 <= data["environmental_metrics"]["carbon_capture_rate"] <= 1.0
        assert 0 <= data["environmental_metrics"]["cooling_efficiency"] <= 1.0
        
    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")

@pytest.mark.asyncio
async def test_toggle_maintenance_mode(
    client: AsyncClient,
    admin_token: dict,
    test_server: Server
):
    """Test server maintenance mode toggling with environmental impact tracking."""
    maintenance_data = {
        "maintenance_mode": True,
        "reason": "Scheduled cooling system maintenance",
        "environmental_impact": {
            "expected_downtime_hours": 4,
            "carbon_capture_interruption": True
        }
    }
    
    try:
        response = await client.post(
            f"/api/v1/servers/{test_server.id}/maintenance",
            json=maintenance_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate maintenance mode
        assert data["maintenance_mode"] is True
        assert "maintenance_start" in data
        assert "expected_completion" in data
        
        # Validate environmental impact tracking
        assert "environmental_impact" in data
        assert "carbon_capture_status" in data["environmental_impact"]
        assert "estimated_co2_impact" in data["environmental_impact"]
        
    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")

@pytest.mark.asyncio
async def test_server_environmental_optimization(
    client: AsyncClient,
    admin_token: dict,
    test_server: Server,
    mock_cooling_system: dict
):
    """Test server environmental optimization endpoints."""
    try:
        response = await client.post(
            f"/api/v1/servers/{test_server.id}/optimize-environmental",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate optimization results
        assert "optimization_results" in data
        assert "cooling_efficiency" in data["optimization_results"]
        assert "power_usage_effectiveness" in data["optimization_results"]
        assert "carbon_capture_efficiency" in data["optimization_results"]
        
        # Validate metrics improvements
        assert data["optimization_results"]["cooling_efficiency"] > 0.8
        assert data["optimization_results"]["power_usage_effectiveness"] < 1.5
        assert data["optimization_results"]["carbon_capture_efficiency"] > 0.7
        
    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")

@pytest.mark.asyncio
async def test_server_deletion(client: AsyncClient, admin_token: dict, test_server: Server):
    """Test server deletion with environmental cleanup tracking."""
    try:
        response = await client.delete(
            f"/api/v1/servers/{test_server.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate deletion
        assert data["status"] == "deleted"
        assert "deletion_timestamp" in data
        
        # Validate environmental cleanup
        assert "environmental_cleanup" in data
        assert "carbon_capture_decommissioned" in data["environmental_cleanup"]
        assert "cooling_system_deactivated" in data["environmental_cleanup"]
        
        # Verify server no longer exists
        response = await client.get(
            f"/api/v1/servers/{test_server.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
        
    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")