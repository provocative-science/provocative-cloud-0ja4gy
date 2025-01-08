import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { Provider } from 'react-redux'; // ^8.0.5
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.0
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // ^29.0.0
import WS from 'jest-websocket-mock'; // ^2.4.0

import { useGpu } from '../../src/hooks/useGpu';
import { GPU, GPUModel, GPUStatus } from '../../src/types/gpu';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../src/config/constants';
import { wsConfig } from '../../src/config/api';

// Mock GPU data with environmental metrics
const mockGpuData: GPU[] = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000' as UUID,
    server_id: '123e4567-e89b-12d3-a456-426614174001' as UUID,
    specifications: {
      model: GPUModel.NVIDIA_A100,
      vram_gb: 80,
      cuda_cores: 6912,
      tensor_cores: 432,
      max_power_watts: 400
    },
    status: GPUStatus.AVAILABLE,
    price_per_hour: 4.50,
    metrics: {
      id: '123e4567-e89b-12d3-a456-426614174002' as UUID,
      gpuId: '123e4567-e89b-12d3-a456-426614174000' as UUID,
      temperatureCelsius: 65,
      powerUsageWatts: 350,
      memoryUsedGb: 40,
      memoryTotalGb: 80,
      utilizationPercent: 75,
      timestamp: Date.now()
    },
    current_user_id: null,
    rental_start: null,
    rental_end: null,
    last_active: Date.now(),
    created_at: Date.now()
  }
];

// Mock environmental metrics data
const mockEnvironmentalMetrics = {
  id: '123e4567-e89b-12d3-a456-426614174003' as UUID,
  co2CapturedKg: 75.5,
  powerUsageEffectiveness: 1.2,
  carbonUsageEffectiveness: 0.8,
  waterUsageEffectiveness: 1.6,
  timestamp: Date.now(),
  lastUpdated: Date.now(),
  trendData: {
    co2CaptureRate: 0.85,
    powerEfficiencyTrend: -0.05,
    waterUsageTrend: 0.02
  }
};

describe('useGpu Hook', () => {
  let mockWebSocket: WS;
  let mockStore: any;
  let wrapper: React.FC;

  beforeEach(() => {
    // Setup WebSocket mock server
    mockWebSocket = new WS(wsConfig.url);
    
    // Setup Redux store mock
    mockStore = configureStore({
      reducer: {
        gpu: (state = { gpus: [] }) => state
      }
    });

    // Setup wrapper with Redux provider
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    // Setup fetch mocks
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/gpu')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGpuData)
        });
      }
      if (url.includes('/environmental/metrics')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEnvironmentalMetrics)
        });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  afterEach(() => {
    WS.clean();
    jest.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useGpu(), { wrapper });

    expect(result.current.gpus).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.selectedGpu).toBeNull();
  });

  it('should fetch and set initial GPU data', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useGpu(), { wrapper });

    await waitForNextUpdate();

    expect(result.current.gpus).toEqual(mockGpuData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle GPU selection', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useGpu(), { wrapper });

    await waitForNextUpdate();

    act(() => {
      result.current.setSelectedGpu(mockGpuData[0]);
    });

    expect(result.current.selectedGpu).toEqual(mockGpuData[0]);
  });

  it('should handle environmental metrics updates', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useGpu(), { wrapper });

    await waitForNextUpdate();

    // Simulate environmental metrics WebSocket message
    act(() => {
      mockWebSocket.send(JSON.stringify({
        type: 'environmental_metrics',
        payload: mockEnvironmentalMetrics
      }));
    });

    await waitForNextUpdate();

    expect(result.current.environmentalMetrics).toMatchObject({
      co2CapturedKg: mockEnvironmentalMetrics.co2CapturedKg,
      powerUsageEffectiveness: mockEnvironmentalMetrics.powerUsageEffectiveness,
      carbonUsageEffectiveness: mockEnvironmentalMetrics.carbonUsageEffectiveness,
      waterUsageEffectiveness: mockEnvironmentalMetrics.waterUsageEffectiveness
    });
  });

  it('should handle GPU metrics updates via WebSocket', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useGpu(), { wrapper });

    await waitForNextUpdate();

    const updatedMetrics = {
      ...mockGpuData[0].metrics,
      temperatureCelsius: 70,
      utilizationPercent: 85
    };

    act(() => {
      mockWebSocket.send(JSON.stringify({
        type: 'gpu_metrics',
        payload: {
          gpuId: mockGpuData[0].id,
          metrics: updatedMetrics
        }
      }));
    });

    await waitForNextUpdate();

    expect(result.current.gpus[0].metrics).toMatchObject(updatedMetrics);
  });

  it('should handle WebSocket reconnection', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useGpu(), { wrapper });

    await waitForNextUpdate();

    // Simulate WebSocket disconnection
    act(() => {
      mockWebSocket.close();
    });

    // Simulate reconnection
    act(() => {
      mockWebSocket = new WS(wsConfig.url);
    });

    await waitForNextUpdate();

    expect(result.current.error).toBeNull();
  });

  it('should cleanup resources on unmount', async () => {
    const { result, waitForNextUpdate, unmount } = renderHook(() => useGpu(), { wrapper });

    await waitForNextUpdate();

    unmount();

    expect(mockWebSocket.readyState).toBe(WebSocket.CLOSED);
  });

  it('should calculate environmental trends correctly', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useGpu(), { wrapper });

    await waitForNextUpdate();

    const newMetrics = {
      ...mockEnvironmentalMetrics,
      co2CapturedKg: mockEnvironmentalMetrics.co2CapturedKg + 10,
      powerUsageEffectiveness: mockEnvironmentalMetrics.powerUsageEffectiveness - 0.1
    };

    act(() => {
      mockWebSocket.send(JSON.stringify({
        type: 'environmental_metrics',
        payload: newMetrics
      }));
    });

    await waitForNextUpdate();

    expect(result.current.environmentalMetrics.trendData).toMatchObject({
      co2CaptureRate: expect.any(Number),
      powerEfficiencyTrend: expect.any(Number),
      waterUsageTrend: expect.any(Number)
    });
  });

  it('should handle error states appropriately', async () => {
    // Mock fetch to simulate error
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { result, waitForNextUpdate } = renderHook(() => useGpu(), { wrapper });

    await waitForNextUpdate();

    expect(result.current.error).toBe('Failed to fetch GPU data');
    expect(result.current.loading).toBe(false);
  });
});