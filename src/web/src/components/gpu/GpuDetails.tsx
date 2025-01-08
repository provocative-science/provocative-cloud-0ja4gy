import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Card,
  CardContent,
  Typography,
  Grid,
  Divider,
  Chip,
  Box,
  IconButton,
  Tooltip
} from '@mui/material';
import currency from 'currency.js';
import { useGpu } from '../../hooks/useGpu';
import { GpuMetrics } from './GpuMetrics';
import { GPU, GPUStatus } from '../../types/gpu';
import { SPECIFICATION_UNITS, ENVIRONMENTAL_CONFIG } from '../../config/constants';

interface GpuDetailsProps {
  gpuId: string;
  onClose: () => void;
  showMetrics: boolean;
  showEnvironmentalMetrics: boolean;
  className?: string;
  preferredCurrency: string;
}

const GpuDetails: React.FC<GpuDetailsProps> = ({
  gpuId,
  onClose,
  showMetrics = true,
  showEnvironmentalMetrics = true,
  className,
  preferredCurrency = 'USD'
}) => {
  const metricsRef = useRef<any>(null);
  const environmentalRef = useRef<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { 
    selectedGpu, 
    setSelectedGpu,
    environmentalData 
  } = useGpu();

  useEffect(() => {
    setSelectedGpu(gpuId);
    return () => setSelectedGpu(null);
  }, [gpuId, setSelectedGpu]);

  const formatPrice = useCallback((price: number, currency: string) => {
    return currency.js(price, {
      symbol: currency === 'USD' ? '$' : '€',
      precision: 2
    }).format();
  }, []);

  const formatEnvironmentalMetrics = useCallback((metrics: any) => {
    return {
      co2Capture: `${metrics.co2CapturedKg.toFixed(2)} ${SPECIFICATION_UNITS.co2_capture_kg}`,
      coolingEfficiency: `${metrics.coolingEfficiency.toFixed(1)}${SPECIFICATION_UNITS.cooling_efficiency}`,
      pue: metrics.powerUsageEffectiveness.toFixed(2)
    };
  }, []);

  const handleRefresh = useCallback(() => {
    if (metricsRef.current) {
      metricsRef.current.refresh();
    }
    if (environmentalRef.current) {
      environmentalRef.current.refresh();
    }
    setLastRefresh(new Date());
  }, []);

  const renderSpecifications = (gpu: GPU) => (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Specifications
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">
              Model
            </Typography>
            <Typography variant="body1">
              {gpu.specifications.model}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">
              VRAM
            </Typography>
            <Typography variant="body1">
              {gpu.specifications.vram_gb} {SPECIFICATION_UNITS.vram_gb}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">
              CUDA Cores
            </Typography>
            <Typography variant="body1">
              {gpu.specifications.cuda_cores}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">
              Tensor Cores
            </Typography>
            <Typography variant="body1">
              {gpu.specifications.tensor_cores}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">
              Max Power
            </Typography>
            <Typography variant="body1">
              {gpu.specifications.max_power_watts} {SPECIFICATION_UNITS.max_power_watts}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderEnvironmentalMetrics = (metrics: any) => {
    const formattedMetrics = formatEnvironmentalMetrics(metrics);
    
    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Environmental Impact
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="textSecondary">
                CO₂ Captured
              </Typography>
              <Typography variant="body1">
                {formattedMetrics.co2Capture}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="textSecondary">
                Cooling Efficiency
              </Typography>
              <Typography variant="body1">
                {formattedMetrics.coolingEfficiency}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="textSecondary">
                Power Usage Effectiveness
              </Typography>
              <Typography variant="body1">
                {formattedMetrics.pue}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  if (!selectedGpu) {
    return null;
  }

  return (
    <Box className={className}>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" component="h2">
              {selectedGpu.specifications.model}
            </Typography>
            <Box>
              <Chip
                label={selectedGpu.status}
                color={selectedGpu.status === GPUStatus.AVAILABLE ? 'success' : 'default'}
                size="small"
                sx={{ mr: 1 }}
              />
              <Typography variant="h6" component="span">
                {formatPrice(selectedGpu.price_per_hour, preferredCurrency)}/hr
              </Typography>
            </Box>
          </Box>

          {renderSpecifications(selectedGpu)}

          {showMetrics && (
            <GpuMetrics
              ref={metricsRef}
              gpuId={selectedGpu.id}
              refreshInterval={METRICS_CONFIG.UPDATE_INTERVAL_MS}
              showCharts={true}
              showEnvironmentalMetrics={showEnvironmentalMetrics}
            />
          )}

          {showEnvironmentalMetrics && environmentalData && (
            renderEnvironmentalMetrics(environmentalData)
          )}

          <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
            <Typography variant="caption" color="textSecondary">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </Typography>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default GpuDetails;