// Image asset management for Provocative Cloud platform
// Provides typed exports for logos, GPU-related images, and UI assets

// Base path for image assets based on environment
export const IMAGE_BASE_PATH = process.env.NODE_ENV === 'production' 
  ? '/assets/images/' 
  : '/src/assets/images/';

// Supported GPU models
export const SUPPORTED_GPU_MODELS = ['A100', 'V100'] as const;
export type GPUModel = typeof SUPPORTED_GPU_MODELS[number];

// Type definitions for image metadata
export interface ImageMetadata {
  default: string;
  width?: number;
  height?: number;
  alt?: string;
  webp?: string;
  fallback?: string;
  responsive?: Record<number, string>;
}

// Image format type
type ImageFormat = 'png' | 'jpg' | 'webp';

// Helper function to generate full image path
export const getImagePath = (imageName: string, format: ImageFormat): string => {
  if (!validateImageExists(`${IMAGE_BASE_PATH}${imageName}.${format}`)) {
    console.warn(`Image not found: ${imageName}.${format}`);
    return `${IMAGE_BASE_PATH}placeholder.${format}`;
  }
  return `${IMAGE_BASE_PATH}${imageName}.${format}`;
};

// Helper function to validate image existence
export const validateImageExists = (imagePath: string): boolean => {
  try {
    // In production, assume images exist as they're bundled
    if (process.env.NODE_ENV === 'production') return true;
    
    // In development, perform actual check
    require(`${imagePath}`);
    return true;
  } catch {
    return false;
  }
};

// Main logo with responsive variants
export const logo: ImageMetadata = {
  default: getImagePath('logo', 'png'),
  webp: getImagePath('logo', 'webp'),
  width: 240,
  height: 60,
  alt: 'Provocative Cloud Logo',
  responsive: {
    320: getImagePath('logo-sm', 'png'),
    768: getImagePath('logo-md', 'png'),
    1024: getImagePath('logo', 'png')
  }
};

// Theme-specific logo variants
export const logoLight: ImageMetadata = {
  default: getImagePath('logo-light', 'png'),
  webp: getImagePath('logo-light', 'webp'),
  width: 240,
  height: 60,
  alt: 'Provocative Cloud Logo - Light Theme'
};

export const logoDark: ImageMetadata = {
  default: getImagePath('logo-dark', 'png'),
  webp: getImagePath('logo-dark', 'webp'),
  width: 240,
  height: 60,
  alt: 'Provocative Cloud Logo - Dark Theme'
};

// GPU placeholder image
export const gpuPlaceholder: ImageMetadata = {
  default: getImagePath('gpu-placeholder', 'png'),
  fallback: getImagePath('gpu-generic', 'png'),
  width: 300,
  height: 200,
  alt: 'GPU Hardware Placeholder'
};

// Carbon capture illustration
export const carbonCapture: ImageMetadata = {
  default: getImagePath('carbon-capture', 'png'),
  webp: getImagePath('carbon-capture', 'webp'),
  width: 600,
  height: 400,
  alt: 'Carbon Capture Technology Illustration'
};

// GPU model-specific images
export const gpuModels: Record<GPUModel, ImageMetadata> = {
  A100: {
    default: getImagePath('gpu-a100', 'png'),
    webp: getImagePath('gpu-a100', 'webp'),
    width: 400,
    height: 300,
    alt: 'NVIDIA A100 GPU'
  },
  V100: {
    default: getImagePath('gpu-v100', 'png'),
    webp: getImagePath('gpu-v100', 'webp'),
    width: 400,
    height: 300,
    alt: 'NVIDIA V100 GPU'
  }
};

// Re-export all image assets
export const images = {
  logo,
  logoLight,
  logoDark,
  gpuPlaceholder,
  carbonCapture,
  gpuModels
} as const;

export default images;