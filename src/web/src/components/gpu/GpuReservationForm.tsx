import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { GPU, GPUModel, GPUStatus } from '../../types/gpu';
import { Button } from '../common/Button';
import { useGpu } from '../../hooks/useGpu';
import { createReservation } from '../../api/reservations';
import { GPU_CONSTANTS, ENVIRONMENTAL_CONFIG } from '../../config/constants';
import { ReservationCreate, DeploymentStatus } from '../../types/reservation';

interface GpuReservationFormProps {
  onSubmit: (data: ReservationCreate) => Promise<void>;
  onCancel: () => void;
  initialGpuId?: string;
}

interface PriceCalculation {
  basePrice: number;
  environmentalImpact: {
    co2Offset: number;
    powerEfficiency: number;
    waterEfficiency: number;
  };
  totalPrice: number;
}

const validationSchema = yup.object().shape({
  gpu_id: yup.string().required('GPU selection is required'),
  duration_hours: yup
    .number()
    .required('Duration is required')
    .min(GPU_CONSTANTS.MIN_RENTAL_HOURS, `Minimum rental duration is ${GPU_CONSTANTS.MIN_RENTAL_HOURS} hour`)
    .max(GPU_CONSTANTS.MAX_RENTAL_HOURS, `Maximum rental duration is ${GPU_CONSTANTS.MAX_RENTAL_HOURS} hours`),
  deployment_type: yup
    .string()
    .oneOf(['ssh', 'jupyter', 'docker'], 'Invalid deployment type')
    .required('Deployment type is required'),
  auto_renew: yup.boolean()
});

export const GpuReservationForm: React.FC<GpuReservationFormProps> = ({
  onSubmit,
  onCancel,
  initialGpuId
}) => {
  // Form state management
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    defaultValues: {
      gpu_id: initialGpuId || '',
      duration_hours: GPU_CONSTANTS.MIN_RENTAL_HOURS,
      deployment_type: 'jupyter' as const,
      auto_renew: false
    },
    mode: 'onChange'
  });

  // GPU management hook
  const { gpus, selectedGpu, setSelectedGpu, environmentalMetrics } = useGpu();

  // Local state
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>(DeploymentStatus.PENDING);
  const [error, setError] = useState<string | null>(null);

  // Watch form values for real-time calculations
  const watchedValues = watch();

  // Calculate total price with environmental impact
  const calculatePrice = useMemo((): PriceCalculation => {
    if (!selectedGpu) {
      return {
        basePrice: 0,
        environmentalImpact: {
          co2Offset: 0,
          powerEfficiency: 0,
          waterEfficiency: 0
        },
        totalPrice: 0
      };
    }

    const basePrice = selectedGpu.price_per_hour * watchedValues.duration_hours;
    const co2Offset = environmentalMetrics.co2CapturedKg;
    const powerEfficiency = environmentalMetrics.powerUsageEffectiveness;
    const waterEfficiency = environmentalMetrics.waterUsageEffectiveness;

    // Apply environmental impact adjustments
    const environmentalDiscount = co2Offset > ENVIRONMENTAL_CONFIG.CO2_CAPTURE_THRESHOLDS.TARGET_RATE_KG_PER_DAY ? 0.05 : 0;
    const totalPrice = basePrice * (1 - environmentalDiscount);

    return {
      basePrice,
      environmentalImpact: {
        co2Offset,
        powerEfficiency,
        waterEfficiency
      },
      totalPrice: Number(totalPrice.toFixed(2))
    };
  }, [selectedGpu, watchedValues.duration_hours, environmentalMetrics]);

  // Handle GPU selection
  useEffect(() => {
    if (initialGpuId) {
      const gpu = gpus.find(g => g.id === initialGpuId);
      if (gpu) {
        setSelectedGpu(gpu);
      }
    }
  }, [initialGpuId, gpus, setSelectedGpu]);

  // Handle form submission
  const onFormSubmit = useCallback(async (formData: any) => {
    try {
      setError(null);
      setDeploymentStatus(DeploymentStatus.PENDING);

      const reservationData: ReservationCreate = {
        gpu_id: formData.gpu_id,
        start_time: Date.now(),
        duration_hours: formData.duration_hours,
        deployment_type: formData.deployment_type,
        auto_renew: formData.auto_renew,
        user_id: '' // Will be set by the API based on authenticated user
      };

      await onSubmit(reservationData);
      setDeploymentStatus(DeploymentStatus.PROVISIONING);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reservation');
      setDeploymentStatus(DeploymentStatus.ERROR);
    }
  }, [onSubmit]);

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* GPU Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Select GPU
        </label>
        <select
          {...register('gpu_id')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          onChange={(e) => {
            const gpu = gpus.find(g => g.id === e.target.value);
            setSelectedGpu(gpu || null);
          }}
        >
          <option value="">Select a GPU</option>
          {gpus.map((gpu) => (
            <option
              key={gpu.id}
              value={gpu.id}
              disabled={gpu.status !== GPUStatus.AVAILABLE}
            >
              {gpu.specifications.model} - {gpu.specifications.vram_gb}GB
              ({gpu.price_per_hour}/hour)
            </option>
          ))}
        </select>
        {errors.gpu_id && (
          <p className="text-sm text-red-600">{errors.gpu_id.message}</p>
        )}
      </div>

      {/* Duration Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Rental Duration (hours)
        </label>
        <input
          type="number"
          {...register('duration_hours')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          min={GPU_CONSTANTS.MIN_RENTAL_HOURS}
          max={GPU_CONSTANTS.MAX_RENTAL_HOURS}
        />
        {errors.duration_hours && (
          <p className="text-sm text-red-600">{errors.duration_hours.message}</p>
        )}
      </div>

      {/* Deployment Type */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Deployment Type
        </label>
        <select
          {...register('deployment_type')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        >
          <option value="jupyter">Jupyter Notebook</option>
          <option value="ssh">SSH Access</option>
          <option value="docker">Docker Container</option>
        </select>
        {errors.deployment_type && (
          <p className="text-sm text-red-600">{errors.deployment_type.message}</p>
        )}
      </div>

      {/* Auto-renew Option */}
      <div className="flex items-center">
        <input
          type="checkbox"
          {...register('auto_renew')}
          className="h-4 w-4 rounded border-gray-300 text-primary"
        />
        <label className="ml-2 block text-sm text-gray-700">
          Auto-renew reservation
        </label>
      </div>

      {/* Price Calculation */}
      {selectedGpu && (
        <div className="rounded-md bg-gray-50 p-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Price Breakdown</h4>
          <div className="text-sm text-gray-600">
            <p>Base Price: ${calculatePrice.basePrice.toFixed(2)}</p>
            <p>CO₂ Offset: {calculatePrice.environmentalImpact.co2Offset.toFixed(2)}kg</p>
            <p>Power Efficiency: {calculatePrice.environmentalImpact.powerEfficiency.toFixed(2)} PUE</p>
            <p className="font-medium mt-2">
              Total Price: ${calculatePrice.totalPrice.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-4">
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          type="submit"
          disabled={isSubmitting || !selectedGpu}
          loading={isSubmitting}
        >
          {isSubmitting ? 'Creating Reservation...' : 'Create Reservation'}
        </Button>
      </div>
    </form>
  );
};

export type { GpuReservationFormProps, PriceCalculation };