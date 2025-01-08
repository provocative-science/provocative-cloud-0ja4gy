/**
 * API client module for server-related operations in the Provocative Cloud frontend
 * Handles server management, status updates, metrics retrieval, and environmental monitoring
 * @version 1.0.0
 */

import { get, post, put, websocket } from '../utils/api';
import { API_ENDPOINTS } from '../config/api';
import { 
  Server, 
  ServerStatus, 
  ServerFilter, 
  ServerSpecification,
  CarbonMetrics,
  MaintenanceRecord
} from '../types/server';
import { ApiResponse } from '../types/common';

/**
 * Retrieves list of servers with optional filtering and environmental metrics
 * @param filter - Optional server filtering criteria
 * @param includeEnvironmentalMetrics - Whether to include environmental data
 */
export async function getServers(
  filter?: ServerFilter,
  includeEnvironmentalMetrics = true
): Promise<ApiResponse<Server[]>> {
  const queryParams = new URLSearchParams();
  
  if (filter) {
    if (filter.status?.length) {
      queryParams.append('status', filter.status.join(','));
    }
    if (filter.hasAvailableGPUs !== undefined) {
      queryParams.append('hasAvailableGPUs', String(filter.hasAvailableGPUs));
    }
    if (filter.minGpuCount !== undefined) {
      queryParams.append('minGpuCount', String(filter.minGpuCount));
    }
    if (filter.region) {
      queryParams.append('region', filter.region);
    }
    if (filter.performanceThreshold !== undefined) {
      queryParams.append('performanceThreshold', String(filter.performanceThreshold));
    }
  }

  if (includeEnvironmentalMetrics) {
    queryParams.append('includeEnvironmental', 'true');
  }

  const endpoint = `${API_ENDPOINTS.SERVERS.LIST}?${queryParams.toString()}`;
  return get<Server[]>(endpoint);
}

/**
 * Retrieves detailed information for a specific server including environmental metrics
 * @param serverId - Unique identifier of the server
 * @param includeEnvironmentalMetrics - Whether to include environmental data
 */
export async function getServerById(
  serverId: string,
  includeEnvironmentalMetrics = true
): Promise<ApiResponse<Server>> {
  const queryParams = new URLSearchParams();
  
  if (includeEnvironmentalMetrics) {
    queryParams.append('includeEnvironmental', 'true');
  }

  const endpoint = `${API_ENDPOINTS.SERVERS.DETAILS(serverId)}?${queryParams.toString()}`;
  return get<Server>(endpoint);
}

/**
 * Updates the operational status of a server with environmental impact tracking
 * @param serverId - Unique identifier of the server
 * @param status - New server status
 * @param metrics - Updated environmental metrics
 */
export async function updateServerStatus(
  serverId: string,
  status: ServerStatus,
  metrics?: CarbonMetrics
): Promise<ApiResponse<Server>> {
  const endpoint = API_ENDPOINTS.SERVERS.STATUS(serverId);
  return put<Server>(endpoint, {
    status,
    environmentalMetrics: metrics
  });
}

/**
 * Enables or disables maintenance mode with scheduled windows
 * @param serverId - Unique identifier of the server
 * @param enabled - Whether maintenance mode should be enabled
 * @param maintenanceRecord - Optional maintenance schedule details
 */
export async function toggleMaintenanceMode(
  serverId: string,
  enabled: boolean,
  maintenanceRecord?: Omit<MaintenanceRecord, 'id' | 'status'>
): Promise<ApiResponse<Server>> {
  const endpoint = API_ENDPOINTS.SERVERS.MAINTENANCE(serverId);
  return put<Server>(endpoint, {
    maintenanceMode: enabled,
    maintenanceSchedule: maintenanceRecord
  });
}

/**
 * Updates server specifications with environmental efficiency metrics
 * @param serverId - Unique identifier of the server
 * @param specifications - Updated server specifications
 * @param carbonMetrics - Updated environmental metrics
 */
export async function updateServerSpecification(
  serverId: string,
  specifications: Partial<ServerSpecification>,
  carbonMetrics?: Partial<CarbonMetrics>
): Promise<ApiResponse<Server>> {
  const endpoint = API_ENDPOINTS.SERVERS.SPECIFICATIONS(serverId);
  return put<Server>(endpoint, {
    specifications,
    carbonMetrics
  });
}

/**
 * Establishes WebSocket connection for real-time environmental metrics
 * @param serverId - Unique identifier of the server
 * @param onMetricsUpdate - Callback for handling metrics updates
 */
export async function subscribeToEnvironmentalMetrics(
  serverId: string,
  onMetricsUpdate: (metrics: CarbonMetrics) => void
): Promise<WebSocket> {
  const ws = await websocket(API_ENDPOINTS.ENVIRONMENTAL.METRICS_STREAM(serverId));

  ws.addEventListener('message', (event) => {
    try {
      const metrics = JSON.parse(event.data) as CarbonMetrics;
      onMetricsUpdate(metrics);
    } catch (error) {
      console.error('Error parsing environmental metrics:', error);
    }
  });

  return ws;
}

/**
 * Retrieves server maintenance history with environmental impact data
 * @param serverId - Unique identifier of the server
 */
export async function getMaintenanceHistory(
  serverId: string
): Promise<ApiResponse<MaintenanceRecord[]>> {
  const endpoint = API_ENDPOINTS.SERVERS.MAINTENANCE_HISTORY(serverId);
  return get<MaintenanceRecord[]>(endpoint);
}

/**
 * Updates server environmental metrics
 * @param serverId - Unique identifier of the server
 * @param metrics - New environmental metrics
 */
export async function updateEnvironmentalMetrics(
  serverId: string,
  metrics: Partial<CarbonMetrics>
): Promise<ApiResponse<Server>> {
  const endpoint = API_ENDPOINTS.ENVIRONMENTAL.UPDATE(serverId);
  return put<Server>(endpoint, { metrics });
}