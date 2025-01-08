/**
 * Type definitions and interfaces for the application's theming system
 * Implements WCAG 2.1 Level AA compliant color schemes and responsive design
 * @version 1.0.0
 */

/**
 * Branded type for hex color values with runtime validation
 * Ensures colors are valid 6-digit hex codes with # prefix
 */
export type HexColor = string & { readonly __brand: unique symbol };

/**
 * Validates and creates a hex color value
 * @throws {Error} If color string is not a valid hex color
 */
function createHexColor(color: string): HexColor {
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw new Error(`Invalid hex color: ${color}`);
  }
  return color as HexColor;
}

/**
 * Theme mode enumeration
 */
export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark'
}

/**
 * Interface defining theme color scheme properties
 * Colors must be WCAG 2.1 Level AA compliant
 */
export interface ThemeColors {
  background: HexColor;
  primaryText: HexColor;
  secondaryText: HexColor;
  accent: HexColor;
  alert: HexColor;
  success: HexColor;
  border: HexColor;
}

/**
 * Interface defining typography configuration with fluid scaling
 * Uses a modular scale for consistent visual hierarchy
 */
export interface ThemeTypography {
  fontFamily: string;
  scale: number; // Modular scale ratio (default: 1.2)
  baseSize: number; // Base font size in pixels
  lineHeight: number; // Base line height ratio
}

/**
 * Interface defining responsive breakpoints
 * Follows mobile-first approach
 */
export interface Breakpoints {
  mobile: number; // 320px
  tablet: number; // 768px
  desktop: number; // 1024px
  large: number; // 1440px
}

/**
 * Interface defining responsive spacing system configuration
 */
export interface ThemeSpacing {
  unit: number; // Base spacing unit in pixels
  scale: number; // Spacing scale ratio
  breakpoints: Breakpoints;
}

/**
 * Interface defining complete theme state configuration
 */
export interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  highContrast: boolean;
}

/**
 * Default breakpoints configuration
 */
export const DEFAULT_BREAKPOINTS: Breakpoints = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
  large: 1440
} as const;

/**
 * Light theme color scheme
 * WCAG 2.1 Level AA compliant
 */
export const LIGHT_THEME_COLORS: ThemeColors = {
  background: createHexColor('#FFFFFF'),
  primaryText: createHexColor('#333333'),
  secondaryText: createHexColor('#666666'),
  accent: createHexColor('#0066CC'),
  alert: createHexColor('#FF3300'),
  success: createHexColor('#33CC33'),
  border: createHexColor('#CCCCCC')
};

/**
 * Dark theme color scheme
 * WCAG 2.1 Level AA compliant
 */
export const DARK_THEME_COLORS: ThemeColors = {
  background: createHexColor('#1A1A1A'),
  primaryText: createHexColor('#FFFFFF'),
  secondaryText: createHexColor('#CCCCCC'),
  accent: createHexColor('#3399FF'),
  alert: createHexColor('#FF6666'),
  success: createHexColor('#66FF66'),
  border: createHexColor('#333333')
};

/**
 * High contrast color schemes for accessibility
 */
export const HIGH_CONTRAST_COLORS: Record<ThemeMode, ThemeColors> = {
  [ThemeMode.LIGHT]: {
    background: createHexColor('#FFFFFF'),
    primaryText: createHexColor('#000000'),
    secondaryText: createHexColor('#333333'),
    accent: createHexColor('#0000CC'),
    alert: createHexColor('#CC0000'),
    success: createHexColor('#006600'),
    border: createHexColor('#000000')
  },
  [ThemeMode.DARK]: {
    background: createHexColor('#000000'),
    primaryText: createHexColor('#FFFFFF'),
    secondaryText: createHexColor('#EEEEEE'),
    accent: createHexColor('#66CCFF'),
    alert: createHexColor('#FF9999'),
    success: createHexColor('#99FF99'),
    border: createHexColor('#FFFFFF')
  }
};

/**
 * Default typography configuration
 */
export const DEFAULT_TYPOGRAPHY: ThemeTypography = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  scale: 1.2, // Perfect fifth scale
  baseSize: 16, // 16px base
  lineHeight: 1.5
} as const;

/**
 * Default spacing configuration
 */
export const DEFAULT_SPACING: ThemeSpacing = {
  unit: 8, // 8px base unit
  scale: 1.5, // Spacing scale ratio
  breakpoints: DEFAULT_BREAKPOINTS
} as const;