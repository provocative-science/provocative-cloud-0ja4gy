/**
 * Core theme configuration file that defines theme constants, default values,
 * and theme generation utilities for the application's theming system
 * @version 1.0.0
 */

import {
  ThemeMode,
  ThemeColors,
  ThemeTypography,
  ThemeSpacing,
  ThemeState,
  LIGHT_THEME_COLORS,
  DARK_THEME_COLORS,
  HIGH_CONTRAST_COLORS,
  DEFAULT_TYPOGRAPHY,
  DEFAULT_SPACING
} from '../types/theme';

// Default theme mode
export const DEFAULT_THEME_MODE = ThemeMode.LIGHT;

// Default high contrast setting
export const DEFAULT_HIGH_CONTRAST = false;

/**
 * Generates theme colors based on mode and high contrast settings
 * @param mode - Theme mode (light/dark)
 * @param highContrast - High contrast mode enabled flag
 * @returns Theme color configuration object
 */
export const generateThemeColors = (
  mode: ThemeMode,
  highContrast: boolean
): ThemeColors => {
  if (highContrast) {
    return HIGH_CONTRAST_COLORS[mode];
  }
  
  return mode === ThemeMode.LIGHT
    ? LIGHT_THEME_COLORS
    : DARK_THEME_COLORS;
};

/**
 * Generates typography configuration with fluid scaling
 * Uses modular scale for consistent visual hierarchy
 * @returns Typography configuration object
 */
export const generateThemeTypography = (): ThemeTypography => {
  return {
    ...DEFAULT_TYPOGRAPHY
  };
};

/**
 * Generates spacing configuration with responsive breakpoints
 * Uses 8-point grid system as base
 * @returns Spacing configuration object
 */
export const generateThemeSpacing = (): ThemeSpacing => {
  return {
    ...DEFAULT_SPACING
  };
};

/**
 * Default light theme configuration
 */
export const lightTheme: ThemeState = {
  mode: ThemeMode.LIGHT,
  colors: generateThemeColors(ThemeMode.LIGHT, false),
  typography: generateThemeTypography(),
  spacing: generateThemeSpacing(),
  highContrast: false
};

/**
 * Default dark theme configuration
 */
export const darkTheme: ThemeState = {
  mode: ThemeMode.DARK,
  colors: generateThemeColors(ThemeMode.DARK, false),
  typography: generateThemeTypography(),
  spacing: generateThemeSpacing(),
  highContrast: false
};

/**
 * Default theme state configuration
 * Uses light theme as default with standard contrast
 */
export const defaultTheme: ThemeState = {
  mode: DEFAULT_THEME_MODE,
  colors: generateThemeColors(DEFAULT_THEME_MODE, DEFAULT_HIGH_CONTRAST),
  typography: generateThemeTypography(),
  spacing: generateThemeSpacing(),
  highContrast: DEFAULT_HIGH_CONTRAST
};

/**
 * Re-export theme generation utilities for external use
 */
export {
  generateThemeColors,
  generateThemeTypography,
  generateThemeSpacing
};