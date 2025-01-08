import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react';
import { ThemeProvider } from '@mui/material';
import { GpuCard, GpuCardProps } from '../../src/components/gpu/GpuCard';
import { GPU, GPUModel, GPUStatus } from '../../src/types/gpu';
import { ENVIRONMENTAL_CONFIG } from '../../config/constants';

// Mock WebSocket for real-time updates
jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  };
  return {
    io: jest.fn(() => mockSocket)
  };
});

// Test IDs for component selection
const TEST_IDS = {
  gpu_card: 'gpu-card',
  metrics_section: 'gpu-metrics',
  environmental_section: 'environmental-metrics',
  rent_button: 'rent-gpu-button',
  loading_skeleton: 'loading-skeleton'
};

// Mock GPU data with environmental metrics
const mockGpu: GPU = {
  id: 'test-gpu-id',
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
    temperature_celsius: 65,
    power_usage_watts: 350,
    memory_used_gb: 0,
    utilization_percent: 0,
    environmental_metrics: {
      co2_captured_kg: 2.5,
      power_usage_effectiveness: 1.1,
      carbon_usage_effectiveness: 0.8,
      water_usage_effectiveness: 1.2
    }
  }
};

// Helper function to render GpuCard with theme context
const renderGpuCard = (props: Partial<GpuCardProps> = {}) => {
  const defaultProps: GpuCardProps = {
    gpu: mockGpu,
    showMetrics: true,
    showEnvironmentalMetrics: true,
    ...props
  };

  return render(
    <ThemeProvider theme={{ colors: { background: '#fff' } }}>
      <GpuCard {...defaultProps} />
    </ThemeProvider>
  );
};

describe('GpuCard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders GPU information correctly', () => {
      renderGpuCard();

      // Check basic GPU info
      expect(screen.getByText(mockGpu.specifications.model)).toBeInTheDocument();
      expect(screen.getByText(`${mockGpu.specifications.vram_gb} GB`)).toBeInTheDocument();
      expect(screen.getByText(`${mockGpu.specifications.cuda_cores}`)).toBeInTheDocument();
      expect(screen.getByText(`${mockGpu.specifications.tensor_cores}`)).toBeInTheDocument();

      // Check price display
      expect(screen.getByText(/\$4\.50\/hour/)).toBeInTheDocument();

      // Check status badge
      expect(screen.getByText(mockGpu.status.toUpperCase())).toBeInTheDocument();
    });

    it('renders environmental metrics when enabled', () => {
      renderGpuCard({ showEnvironmentalMetrics: true });

      // Check environmental metrics section
      const envSection = screen.getByTestId(TEST_IDS.environmental_section);
      expect(envSection).toBeInTheDocument();

      // Check CO2 capture display
      expect(within(envSection).getByText('2.5 kg')).toBeInTheDocument();

      // Check efficiency ratios
      expect(within(envSection).getByText('1.1')).toBeInTheDocument(); // PUE
    });

    it('hides environmental metrics when disabled', () => {
      renderGpuCard({ showEnvironmentalMetrics: false });
      expect(screen.queryByTestId(TEST_IDS.environmental_section)).not.toBeInTheDocument();
    });

    it('renders in compact mode correctly', () => {
      renderGpuCard({ compact: true });
      expect(screen.queryByText('Tensor Cores:')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('handles rent button click', async () => {
      const onRent = jest.fn();
      renderGpuCard({ onRent });

      const rentButton = screen.getByTestId(TEST_IDS.rent_button);
      await userEvent.click(rentButton);

      expect(onRent).toHaveBeenCalledWith(mockGpu);
    });

    it('disables rent button when GPU is not available', () => {
      const unavailableGpu = { ...mockGpu, status: GPUStatus.IN_USE };
      renderGpuCard({ gpu: unavailableGpu });

      expect(screen.queryByTestId(TEST_IDS.rent_button)).not.toBeInTheDocument();
    });

    it('handles card click when clickable', async () => {
      const onClick = jest.fn();
      renderGpuCard({ onClick });

      const card = screen.getByTestId(TEST_IDS.gpu_card);
      await userEvent.click(card);

      expect(onClick).toHaveBeenCalledWith(mockGpu);
    });
  });

  describe('Real-time Updates', () => {
    it('updates metrics display on WebSocket message', async () => {
      const { rerender } = renderGpuCard();

      const updatedGpu = {
        ...mockGpu,
        metrics: {
          ...mockGpu.metrics,
          temperature_celsius: 70,
          utilization_percent: 80
        }
      };

      rerender(
        <ThemeProvider theme={{ colors: { background: '#fff' } }}>
          <GpuCard gpu={updatedGpu} showMetrics showEnvironmentalMetrics />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('70°C')).toBeInTheDocument();
        expect(screen.getByText('80%')).toBeInTheDocument();
      });
    });

    it('updates environmental metrics on WebSocket message', async () => {
      const { rerender } = renderGpuCard();

      const updatedGpu = {
        ...mockGpu,
        metrics: {
          ...mockGpu.metrics,
          environmental_metrics: {
            ...mockGpu.metrics.environmental_metrics,
            co2_captured_kg: 3.0
          }
        }
      };

      rerender(
        <ThemeProvider theme={{ colors: { background: '#fff' } }}>
          <GpuCard gpu={updatedGpu} showMetrics showEnvironmentalMetrics />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('3.0 kg')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG accessibility guidelines', async () => {
      const { container } = renderGpuCard();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper ARIA labels', () => {
      renderGpuCard();
      const card = screen.getByTestId(TEST_IDS.gpu_card);
      expect(card).toHaveAttribute('aria-label', `${mockGpu.specifications.model} GPU Card`);
    });

    it('supports keyboard navigation', async () => {
      const onRent = jest.fn();
      renderGpuCard({ onRent });

      const rentButton = screen.getByTestId(TEST_IDS.rent_button);
      await userEvent.tab();
      expect(rentButton).toHaveFocus();

      await userEvent.keyboard('{enter}');
      expect(onRent).toHaveBeenCalledWith(mockGpu);
    });
  });

  describe('Styling', () => {
    it('applies correct theme styles', () => {
      renderGpuCard({ highContrast: true });
      const card = screen.getByTestId(TEST_IDS.gpu_card);
      expect(card).toHaveStyle({ backgroundColor: '#fff' });
    });

    it('handles theme changes correctly', () => {
      const { rerender } = renderGpuCard();
      
      rerender(
        <ThemeProvider theme={{ colors: { background: '#000' } }}>
          <GpuCard gpu={mockGpu} showMetrics showEnvironmentalMetrics />
        </ThemeProvider>
      );

      const card = screen.getByTestId(TEST_IDS.gpu_card);
      expect(card).toHaveStyle({ backgroundColor: '#000' });
    });
  });
});