import { describe, it, expect } from '@jest/globals'; // v29.5.0
import {
  isValidEmail,
  isValidUUID,
  isValidUserRole,
  isValidGPUModel,
  isValidGPUStatus,
  isValidGPUSpecification,
  isValidDateRange,
  validatePassword
} from '../../src/utils/validation';
import { UserRole } from '../../src/types/auth';
import { GPUModel, GPUStatus } from '../../src/types/gpu';

const VALID_TEST_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_TEST_EMAIL = 'test@provocative.cloud';
const VALID_TEST_PASSWORD = 'Test123!@#';
const VALID_GPU_SPEC = {
  model: GPUModel.NVIDIA_A100,
  vram_gb: 80,
  cuda_cores: 6912,
  tensor_cores: 432,
  max_power_watts: 400
};
const VALID_DATE_RANGE = {
  startDate: new Date('2024-01-01').getTime(),
  endDate: new Date('2024-12-31').getTime(),
  inclusive: true
};

describe('isValidEmail', () => {
  it('should validate correct email formats', () => {
    expect(isValidEmail(VALID_TEST_EMAIL)).toBe(true);
    expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
    expect(isValidEmail('user@subdomain.domain.com')).toBe(true);
  });

  it('should reject invalid email formats', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('invalid@email')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@.com')).toBe(false);
    expect(isValidEmail('user@domain.')).toBe(false);
  });

  it('should handle SQL injection attempts', () => {
    expect(isValidEmail("' OR '1'='1")).toBe(false);
    expect(isValidEmail('user@domain.com; DROP TABLE users;')).toBe(false);
  });

  it('should reject non-string inputs', () => {
    expect(isValidEmail(null as any)).toBe(false);
    expect(isValidEmail(undefined as any)).toBe(false);
    expect(isValidEmail({} as any)).toBe(false);
    expect(isValidEmail(123 as any)).toBe(false);
  });
});

describe('isValidUUID', () => {
  it('should validate correct UUID v4 format', () => {
    expect(isValidUUID(VALID_TEST_UUID)).toBe(true);
  });

  it('should reject invalid UUID formats', () => {
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('invalid-uuid')).toBe(false);
    expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
    expect(isValidUUID('123e4567-e89b-12d3-a456-42661417400g')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isValidUUID(VALID_TEST_UUID.toUpperCase())).toBe(true);
    expect(isValidUUID(VALID_TEST_UUID.toLowerCase())).toBe(true);
  });

  it('should reject non-string inputs', () => {
    expect(isValidUUID(null as any)).toBe(false);
    expect(isValidUUID(undefined as any)).toBe(false);
    expect(isValidUUID({} as any)).toBe(false);
    expect(isValidUUID(123 as any)).toBe(false);
  });
});

describe('isValidUserRole', () => {
  it('should validate all defined user roles', () => {
    Object.values(UserRole).forEach(role => {
      expect(isValidUserRole(role)).toBe(true);
    });
  });

  it('should reject invalid roles', () => {
    expect(isValidUserRole('')).toBe(false);
    expect(isValidUserRole('INVALID_ROLE')).toBe(false);
    expect(isValidUserRole('user')).toBe(false);
    expect(isValidUserRole('SUPERADMIN')).toBe(false);
  });

  it('should be case-sensitive', () => {
    expect(isValidUserRole('user')).toBe(false);
    expect(isValidUserRole('USER')).toBe(true);
  });

  it('should reject non-string inputs', () => {
    expect(isValidUserRole(null as any)).toBe(false);
    expect(isValidUserRole(undefined as any)).toBe(false);
    expect(isValidUserRole({} as any)).toBe(false);
    expect(isValidUserRole(123 as any)).toBe(false);
  });
});

describe('isValidGPUModel', () => {
  it('should validate all defined GPU models', () => {
    Object.values(GPUModel).forEach(model => {
      expect(isValidGPUModel(model)).toBe(true);
    });
  });

  it('should reject invalid models', () => {
    expect(isValidGPUModel('')).toBe(false);
    expect(isValidGPUModel('INVALID_MODEL')).toBe(false);
    expect(isValidGPUModel('RTX 3090')).toBe(false);
  });

  it('should be case-sensitive and space-aware', () => {
    expect(isValidGPUModel('NVIDIA A100')).toBe(false);
    expect(isValidGPUModel('NVIDIA_A100')).toBe(false);
    expect(isValidGPUModel(GPUModel.NVIDIA_A100)).toBe(true);
  });

  it('should reject non-string inputs', () => {
    expect(isValidGPUModel(null as any)).toBe(false);
    expect(isValidGPUModel(undefined as any)).toBe(false);
    expect(isValidGPUModel({} as any)).toBe(false);
    expect(isValidGPUModel(123 as any)).toBe(false);
  });
});

describe('isValidGPUStatus', () => {
  it('should validate all defined GPU statuses', () => {
    Object.values(GPUStatus).forEach(status => {
      expect(isValidGPUStatus(status)).toBe(true);
    });
  });

  it('should reject invalid statuses', () => {
    expect(isValidGPUStatus('')).toBe(false);
    expect(isValidGPUStatus('INVALID_STATUS')).toBe(false);
    expect(isValidGPUStatus('offline')).toBe(false);
  });

  it('should be case-sensitive', () => {
    expect(isValidGPUStatus('AVAILABLE')).toBe(false);
    expect(isValidGPUStatus('available')).toBe(true);
  });

  it('should reject non-string inputs', () => {
    expect(isValidGPUStatus(null as any)).toBe(false);
    expect(isValidGPUStatus(undefined as any)).toBe(false);
    expect(isValidGPUStatus({} as any)).toBe(false);
    expect(isValidGPUStatus(123 as any)).toBe(false);
  });
});

describe('isValidGPUSpecification', () => {
  it('should validate correct GPU specifications', () => {
    expect(isValidGPUSpecification(VALID_GPU_SPEC)).toBe(true);
  });

  it('should validate property ranges', () => {
    const testSpecs = [
      { ...VALID_GPU_SPEC, vram_gb: 7 },
      { ...VALID_GPU_SPEC, vram_gb: 129 },
      { ...VALID_GPU_SPEC, cuda_cores: 999 },
      { ...VALID_GPU_SPEC, cuda_cores: 100001 },
      { ...VALID_GPU_SPEC, tensor_cores: -1 },
      { ...VALID_GPU_SPEC, tensor_cores: 1001 },
      { ...VALID_GPU_SPEC, max_power_watts: 99 },
      { ...VALID_GPU_SPEC, max_power_watts: 1001 }
    ];

    testSpecs.forEach(spec => {
      expect(isValidGPUSpecification(spec)).toBe(false);
    });
  });

  it('should require all mandatory fields', () => {
    const { model, ...missingModel } = VALID_GPU_SPEC;
    const { vram_gb, ...missingVram } = VALID_GPU_SPEC;
    const { cuda_cores, ...missingCuda } = VALID_GPU_SPEC;

    expect(isValidGPUSpecification(missingModel)).toBe(false);
    expect(isValidGPUSpecification(missingVram)).toBe(false);
    expect(isValidGPUSpecification(missingCuda)).toBe(false);
  });

  it('should reject invalid input types', () => {
    expect(isValidGPUSpecification(null)).toBe(false);
    expect(isValidGPUSpecification(undefined)).toBe(false);
    expect(isValidGPUSpecification({})).toBe(false);
    expect(isValidGPUSpecification([])).toBe(false);
  });
});

describe('isValidDateRange', () => {
  it('should validate correct date ranges', () => {
    expect(isValidDateRange(VALID_DATE_RANGE)).toBe(true);
  });

  it('should reject invalid date formats', () => {
    expect(isValidDateRange({ startDate: 'invalid', endDate: 'invalid', inclusive: true })).toBe(false);
    expect(isValidDateRange({ startDate: null, endDate: null, inclusive: true })).toBe(false);
  });

  it('should validate date order', () => {
    const invalidRange = {
      startDate: new Date('2024-12-31').getTime(),
      endDate: new Date('2024-01-01').getTime(),
      inclusive: true
    };
    expect(isValidDateRange(invalidRange)).toBe(false);
  });

  it('should handle inclusive/exclusive ranges', () => {
    const sameDate = new Date('2024-01-01').getTime();
    expect(isValidDateRange({ startDate: sameDate, endDate: sameDate, inclusive: true })).toBe(true);
    expect(isValidDateRange({ startDate: sameDate, endDate: sameDate, inclusive: false })).toBe(false);
  });
});

describe('validatePassword', () => {
  it('should validate strong passwords', () => {
    const result = validatePassword(VALID_TEST_PASSWORD);
    expect(result.success).toBe(true);
    expect(result.score).toBe(100);
    expect(result.errors).toHaveLength(0);
  });

  it('should check minimum length requirement', () => {
    const result = validatePassword('Abc1!');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  it('should require uppercase letters', () => {
    const result = validatePassword('test123!@#');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  it('should require lowercase letters', () => {
    const result = validatePassword('TEST123!@#');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  it('should require numbers', () => {
    const result = validatePassword('TestPass!@#');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });

  it('should require special characters', () => {
    const result = validatePassword('TestPass123');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Password must contain at least one special character (!@#$%^&*)');
  });

  it('should calculate password strength score', () => {
    const weakPass = validatePassword('Test1!');
    const mediumPass = validatePassword('TestPass1!');
    const strongPass = validatePassword('TestPass123!@#');

    expect(weakPass.score).toBeLessThan(mediumPass.score);
    expect(mediumPass.score).toBeLessThan(strongPass.score);
  });
});