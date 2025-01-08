/**
 * Redux reducer for managing application theme state
 * Implements WCAG 2.1 Level AA compliant theming with responsive design
 * @version 1.0.0
 */

import { AnyAction } from 'redux';
import {
  ThemeMode,
  ThemeState,
  SystemPreference,
  ColorPalette,
  Typography,
  Spacing
} from '../../types/theme';
import {
  defaultTheme,
  generateThemeColors,
  calculateContrastRatio,
  generateResponsiveTypography
} from '../../config/theme';
import {
  SET_THEME_MODE,
  TOGGLE_HIGH_CONTRAST,
  RESET_THEME,
  SET_SYSTEM_PREFERENCE
} from '../actions/theme';

// WCAG 2.1 Level AA contrast requirements
const WCAG_NORMAL_TEXT_RATIO = 4.5;
const WCAG_LARGE_TEXT_RATIO = 3.0;

/**
 * Initial state uses default theme configuration
 */
const initialState: ThemeState = defaultTheme;

/**
 * Validates color contrast ratios against WCAG requirements
 * @param colors - Theme color palette to validate
 * @returns boolean indicating if colors meet WCAG requirements
 */
const validateColorContrast = (colors: ColorPalette): boolean => {
  const textRatios = [
    calculateContrastRatio(colors.background, colors.primaryText),
    calculateContrastRatio(colors.background, colors.secondaryText),
    calculateContrastRatio(colors.background, colors.accent)
  ];

  return textRatios.every(ratio => ratio >= WCAG_NORMAL_TEXT_RATIO);
};

/**
 * Updates typography scale based on viewport size
 * @param typography - Current typography settings
 * @param breakpoint - Current viewport breakpoint
 * @returns Updated typography configuration
 */
const updateResponsiveTypography = (
  typography: Typography,
  breakpoint: number
): Typography => {
  const baseSize = Math.max(
    16,
    Math.min(18, Math.floor(breakpoint / 64))
  );

  return {
    ...typography,
    baseSize,
    scale: breakpoint < 768 ? 1.1 : 1.2
  };
};

/**
 * Updates spacing scale based on viewport size
 * @param spacing - Current spacing settings
 * @param breakpoint - Current viewport breakpoint
 * @returns Updated spacing configuration
 */
const updateResponsiveSpacing = (
  spacing: Spacing,
  breakpoint: number
): Spacing => {
  const unit = Math.max(
    4,
    Math.min(8, Math.floor(breakpoint / 160))
  );

  return {
    ...spacing,
    unit,
    scale: breakpoint < 768 ? 1.25 : 1.5
  };
};

/**
 * Theme reducer handling theme state updates with WCAG compliance
 * @param state - Current theme state
 * @param action - Redux action
 * @returns Updated theme state
 */
const themeReducer = (
  state: ThemeState = initialState,
  action: AnyAction
): ThemeState => {
  switch (action.type) {
    case SET_THEME_MODE: {
      const newColors = generateThemeColors(
        action.payload as ThemeMode,
        state.highContrast
      );

      if (!validateColorContrast(newColors)) {
        console.warn('Generated colors do not meet WCAG contrast requirements');
        return state;
      }

      return {
        ...state,
        mode: action.payload,
        colors: newColors
      };
    }

    case TOGGLE_HIGH_CONTRAST: {
      const newColors = generateThemeColors(
        state.mode,
        !state.highContrast
      );

      return {
        ...state,
        highContrast: !state.highContrast,
        colors: newColors
      };
    }

    case SET_SYSTEM_PREFERENCE: {
      const { colorScheme, viewport } = action.payload as SystemPreference;
      const newMode = colorScheme === 'dark' ? ThemeMode.DARK : ThemeMode.LIGHT;
      const newColors = generateThemeColors(newMode, state.highContrast);
      
      if (!validateColorContrast(newColors)) {
        return state;
      }

      return {
        ...state,
        mode: newMode,
        colors: newColors,
        typography: updateResponsiveTypography(state.typography, viewport.width),
        spacing: updateResponsiveSpacing(state.spacing, viewport.width)
      };
    }

    case RESET_THEME: {
      const systemPreference = window?.matchMedia('(prefers-color-scheme: dark)');
      const defaultMode = systemPreference.matches ? ThemeMode.DARK : ThemeMode.LIGHT;
      
      return {
        ...defaultTheme,
        mode: defaultMode,
        colors: generateThemeColors(defaultMode, false)
      };
    }

    default:
      return state;
  }
};

export default themeReducer;