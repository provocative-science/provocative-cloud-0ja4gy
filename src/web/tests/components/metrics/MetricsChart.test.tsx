import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import WS from 'jest-websocket-mock';

import MetricsChart from '../../../src/components/metrics/MetricsChart';
import { MetricsTimeRange } from '../../../types/metrics';
import { METRICS_CONFIG, ENVIRONMENTAL_CONFIG } from '../../../config/constants';

// Mock WebSocket server
let wsServer: WS;

// Sample test data
const mockGpuMetrics = [
  {
    utilizationPercent: 85,
    memoryUsedGb: 65,
    temperatureCelsius: 75,
    timestamp: Date.now()
  }
];

const mockCarbonMetrics = {
  co2CapturedKg: 100,
  powerUsageEffectiveness: 1.2,
  waterUsageEffectiveness: 1.5,
  carbonUsageEffectiveness: 0.7
};

const mockSystemMetrics = {
  cpuUtilization: 75,
  memoryUsage: 80,
  networkBandwidth: 500
};

describe('MetricsChart Component', () => {
  beforeEach(() => {
    // Set up WebSocket mock server
    wsServer = new WS('ws://localhost:1234/metrics');
  });

  afterEach(() => {
    WS.clean();
  });

  describe('Rendering and Initialization', () => {
    test('renders with accessibility support', () => {
      render(
        <MetricsChart
          type="line"
          metricType="gpu"
          timeRange={MetricsTimeRange.LAST_HOUR}
          accessibilityLabel="GPU Metrics Chart"
        />
      );

      const chart = screen.getByRole('img', { name: 'GPU Metrics Chart' });
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute('aria-label', 'GPU Metrics Chart');
    });

    test('renders loading state correctly', () => {
      render(
        <MetricsChart
          type="line"
          metricType="gpu"
          timeRange={MetricsTimeRange.LAST_HOUR}
        />
      );

      expect(screen.getByText('Loading metrics data...')).toBeInTheDocument();
    });

    test('renders error state correctly', async () => {
      const errorMessage = 'Failed to fetch metrics';
      jest.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <MetricsChart
          type="line"
          metricType="gpu"
          timeRange={MetricsTimeRange.LAST_HOUR}
        />
      );

      await wsServer.connected;
      wsServer.send({ type: 'error', message: errorMessage });

      expect(screen.getByText(`Error loading metrics: ${errorMessage}`)).toBeInTheDocument();
    });
  });

  describe('GPU Metrics Visualization', () => {
    test('displays GPU utilization metrics correctly', async () => {
      render(
        <MetricsChart
          type="line"
          metricType="gpu"
          timeRange={MetricsTimeRange.LAST_HOUR}
          gpuId="test-gpu-1"
        />
      );

      await wsServer.connected;
      wsServer.send({
        type: 'metrics',
        payload: { gpuMetrics: mockGpuMetrics }
      });

      await waitFor(() => {
        const chart = screen.getByRole('img');
        expect(chart).toHaveAttribute('data-testid', 'metrics-chart');
        expect(chart).toContainHTML('GPU Utilization (%)');
        expect(chart).toContainHTML('85%');
      });
    });

    test('updates GPU memory usage in real-time', async () => {
      render(
        <MetricsChart
          type="line"
          metricType="gpu"
          timeRange={MetricsTimeRange.LAST_HOUR}
          gpuId="test-gpu-1"
        />
      );

      await wsServer.connected;
      wsServer.send({
        type: 'metrics',
        payload: {
          gpuMetrics: [{
            ...mockGpuMetrics[0],
            memoryUsedGb: 70
          }]
        }
      });

      await waitFor(() => {
        const chart = screen.getByRole('img');
        expect(chart).toContainHTML('Memory Usage (GB)');
        expect(chart).toContainHTML('70GB');
      });
    });
  });

  describe('Environmental Metrics Visualization', () => {
    test('displays carbon capture metrics correctly', async () => {
      render(
        <MetricsChart
          type="bar"
          metricType="carbon"
          timeRange={MetricsTimeRange.LAST_HOUR}
        />
      );

      await wsServer.connected;
      wsServer.send({
        type: 'metrics',
        payload: { carbonMetrics: mockCarbonMetrics }
      });

      await waitFor(() => {
        const chart = screen.getByRole('img');
        expect(chart).toContainHTML('CO₂ Captured (kg)');
        expect(chart).toContainHTML('100 kg');
      });
    });

    test('validates environmental efficiency thresholds', async () => {
      render(
        <MetricsChart
          type="bar"
          metricType="carbon"
          timeRange={MetricsTimeRange.LAST_HOUR}
        />
      );

      await wsServer.connected;
      wsServer.send({
        type: 'metrics',
        payload: {
          carbonMetrics: {
            ...mockCarbonMetrics,
            powerUsageEffectiveness: ENVIRONMENTAL_CONFIG.EFFECTIVENESS_RATIOS.MAX_PUE + 0.1
          }
        }
      });

      expect(screen.getByText(/exceeds maximum threshold/i)).toBeInTheDocument();
    });
  });

  describe('Real-time Updates and WebSocket', () => {
    test('handles WebSocket reconnection', async () => {
      render(
        <MetricsChart
          type="line"
          metricType="gpu"
          timeRange={MetricsTimeRange.LAST_HOUR}
          gpuId="test-gpu-1"
        />
      );

      await wsServer.connected;
      wsServer.close();

      await waitFor(() => {
        expect(wsServer.server.clients().length).toBe(0);
      });

      const newWsServer = new WS('ws://localhost:1234/metrics');
      await newWsServer.connected;

      expect(newWsServer.server.clients().length).toBe(1);
    });

    test('debounces rapid metric updates', async () => {
      jest.useFakeTimers();

      render(
        <MetricsChart
          type="line"
          metricType="gpu"
          timeRange={MetricsTimeRange.LAST_HOUR}
          gpuId="test-gpu-1"
        />
      );

      await wsServer.connected;

      // Send multiple rapid updates
      for (let i = 0; i < 5; i++) {
        wsServer.send({
          type: 'metrics',
          payload: {
            gpuMetrics: [{
              ...mockGpuMetrics[0],
              utilizationPercent: 85 + i
            }]
          }
        });
      }

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should only render the last update
      await waitFor(() => {
        const chart = screen.getByRole('img');
        expect(chart).toContainHTML('89%');
      });

      jest.useRealTimers();
    });
  });

  describe('Accessibility and Interaction', () => {
    test('supports keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <MetricsChart
          type="line"
          metricType="gpu"
          timeRange={MetricsTimeRange.LAST_HOUR}
          gpuId="test-gpu-1"
        />
      );

      const chart = screen.getByRole('img');
      await user.tab();
      expect(chart).toHaveFocus();
    });

    test('provides ARIA descriptions for data points', async () => {
      render(
        <MetricsChart
          type="line"
          metricType="gpu"
          timeRange={MetricsTimeRange.LAST_HOUR}
          gpuId="test-gpu-1"
          accessibilityLabel="GPU utilization over time"
        />
      );

      await wsServer.connected;
      wsServer.send({
        type: 'metrics',
        payload: { gpuMetrics: mockGpuMetrics }
      });

      await waitFor(() => {
        const chart = screen.getByRole('img');
        expect(chart).toHaveAttribute('aria-description', 'Real-time gpu metrics visualization');
      });
    });
  });
});