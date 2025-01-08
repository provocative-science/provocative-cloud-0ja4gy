/**
 * Font configuration for Provocative Cloud platform
 * Implements WCAG 2.1 Level AA compliant typography with fluid scaling
 * Base scale ratio: 1.2 (Minor Third)
 * @version 1.0.0
 */

/**
 * Primary font stack with system fonts fallback
 * Optimized for readability and performance
 */
export const fontFamily = [
  'Inter',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Oxygen',
  'Ubuntu',
  'Cantarell',
  'Fira Sans',
  'Droid Sans',
  'Helvetica Neue',
  'sans-serif'
].join(',');

/**
 * Font sizes using 1.2 ratio scale (Minor Third)
 * Base size: 1rem (16px)
 * Uses rem units for fluid scaling across breakpoints
 */
export const fontSizes = {
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  md: '1rem',       // 16px (base)
  lg: '1.2rem',     // 19.2px
  xl: '1.44rem',    // 23.04px
  '2xl': '1.728rem',// 27.648px
  '3xl': '2.074rem' // 33.178px
} as const;

/**
 * Font weights for consistent typography
 * Ensures sufficient contrast for WCAG 2.1 Level AA compliance
 */
export const fontWeights = {
  normal: 400,   // Regular text
  medium: 500,   // Emphasized text
  semibold: 600, // Subheadings
  bold: 700      // Headings
} as const;

/**
 * Line heights for optimal readability
 * Meets WCAG 2.1 Level AA requirements for text spacing
 */
export const lineHeights = {
  none: 1,      // Headings and single-line text
  tight: 1.25,  // Compact text blocks
  base: 1.5,    // Default body text (recommended for accessibility)
  relaxed: 1.75,// Improved readability for longer text
  loose: 2      // Maximum spacing for enhanced readability
} as const;

/**
 * Letter spacing configurations for improved legibility
 * Adjusts tracking based on font size and weight
 */
export const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em'
} as const;

/**
 * Type scale modifiers for fluid typography
 * Adjusts font sizes based on viewport width
 */
export const fluidTypeScale = {
  minScreen: '20rem',    // 320px
  maxScreen: '90rem',    // 1440px
  scaleRatio: 1.2,      // Minor Third scale
  baseSize: '1rem'      // 16px
} as const;

/**
 * Helper function to calculate fluid font size
 * @param minSize - Minimum font size in rem
 * @param maxSize - Maximum font size in rem
 * @returns CSS calc() function for fluid typography
 */
export const getFluidFontSize = (minSize: string, maxSize: string): string => {
  return `clamp(${minSize}, calc(${minSize} + (${parseFloat(maxSize)} - ${parseFloat(minSize)}) * ((100vw - ${fluidTypeScale.minScreen}) / (${parseFloat(fluidTypeScale.maxScreen)} - ${parseFloat(fluidTypeScale.minScreen)}))), ${maxSize})`;
};

/**
 * Default text styles meeting WCAG 2.1 Level AA requirements
 */
export const defaultTextStyles = {
  body: {
    fontFamily,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.base,
    letterSpacing: letterSpacing.normal
  },
  heading: {
    fontFamily,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacing.tight
  }
} as const;