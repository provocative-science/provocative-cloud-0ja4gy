/**
 * Validation utility functions for Provocative Cloud frontend
 * Provides comprehensive validation for user inputs, GPU specifications, and data structures
 * @version 1.0.0
 */

import validator from 'validator'; // v13.9.0
import { UUID, ApiError, DateRange } from '../types/common';
import { UserRole, AuthUser } from '../types/auth';
import { GPUModel, GPUStatus, GPUSpecification } from '../types/gpu';

// Global validation constants
const PASSWORD_MIN_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// GPU specification validation ranges
const GPU_VRAM_RANGE = { min: 8, max: 128 };
const GPU_CUDA_CORES_RANGE = { min: 1000, max: 100000 };
const GPU_TENSOR_CORES_RANGE = { min: 0, max: 1000 };
const GPU_POWER_RANGE = { min: 100, max: 1000 };

/**
 * Validates email address format
 * @param email - Email address to validate
 * @returns boolean indicating if email format is valid
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  const sanitizedEmail = validator.trim(email).toLowerCase();
  return validator.isEmail(sanitizedEmail) && EMAIL_REGEX.test(sanitizedEmail);
}

/**
 * Validates UUID format (v4)
 * @param id - UUID string to validate
 * @returns boolean indicating if UUID format is valid
 */
export function isValidUUID(id: string): boolean {
  if (typeof id !== 'string') return false;
  const sanitizedId = validator.trim(id);
  return validator.isUUID(sanitizedId, 4) && UUID_V4_REGEX.test(sanitizedId);
}

/**
 * Enhanced password strength validation with detailed feedback
 * @param password - Password string to validate
 * @returns Validation result with success flag, error messages, and strength score
 */
export function validatePassword(password: string): {
  success: boolean;
  errors: string[];
  score: number;
} {
  const errors: string[] = [];
  let score = 0;

  if (typeof password !== 'string') {
    return { success: false, errors: ['Invalid password type'], score: 0 };
  }

  const sanitizedPassword = validator.trim(password);

  // Length check
  if (sanitizedPassword.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  } else {
    score += 25;
  }

  // Uppercase letter check
  if (!/[A-Z]/.test(sanitizedPassword)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 25;
  }

  // Lowercase letter check
  if (!/[a-z]/.test(sanitizedPassword)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 25;
  }

  // Number check
  if (!/[0-9]/.test(sanitizedPassword)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 15;
  }

  // Special character check
  if (!/[!@#$%^&*]/.test(sanitizedPassword)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  } else {
    score += 10;
  }

  return {
    success: errors.length === 0,
    errors,
    score
  };
}

/**
 * Enhanced GPU specification validation with range checks
 * @param spec - GPU specification object to validate
 * @returns Validation result with valid flag and error messages
 */
export function isValidGPUSpecification(spec: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['Invalid GPU specification format'] };
  }

  const gpuSpec = spec as GPUSpecification;

  // Validate GPU model
  if (!Object.values(GPUModel).includes(gpuSpec.model)) {
    errors.push(`Invalid GPU model. Must be one of: ${Object.values(GPUModel).join(', ')}`);
  }

  // Validate VRAM
  if (
    typeof gpuSpec.vram_gb !== 'number' ||
    gpuSpec.vram_gb < GPU_VRAM_RANGE.min ||
    gpuSpec.vram_gb > GPU_VRAM_RANGE.max
  ) {
    errors.push(`VRAM must be between ${GPU_VRAM_RANGE.min}GB and ${GPU_VRAM_RANGE.max}GB`);
  }

  // Validate CUDA cores
  if (
    !Number.isInteger(gpuSpec.cuda_cores) ||
    gpuSpec.cuda_cores < GPU_CUDA_CORES_RANGE.min ||
    gpuSpec.cuda_cores > GPU_CUDA_CORES_RANGE.max
  ) {
    errors.push(
      `CUDA cores must be an integer between ${GPU_CUDA_CORES_RANGE.min} and ${GPU_CUDA_CORES_RANGE.max}`
    );
  }

  // Validate tensor cores
  if (
    !Number.isInteger(gpuSpec.tensor_cores) ||
    gpuSpec.tensor_cores < GPU_TENSOR_CORES_RANGE.min ||
    gpuSpec.tensor_cores > GPU_TENSOR_CORES_RANGE.max
  ) {
    errors.push(
      `Tensor cores must be an integer between ${GPU_TENSOR_CORES_RANGE.min} and ${GPU_TENSOR_CORES_RANGE.max}`
    );
  }

  // Validate power consumption
  if (
    typeof gpuSpec.max_power_watts !== 'number' ||
    gpuSpec.max_power_watts < GPU_POWER_RANGE.min ||
    gpuSpec.max_power_watts > GPU_POWER_RANGE.max
  ) {
    errors.push(
      `Maximum power consumption must be between ${GPU_POWER_RANGE.min}W and ${GPU_POWER_RANGE.max}W`
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}