/**
 * Redux action creators and action types for managing application theme state
 * Implements theme mode switching, high contrast mode, and theme reset functionality
 * @version 1.0.0
 */

import { ThemeMode, ThemeAction } from '../../types/theme';

/**
 * Action type constants for theme management
 */
export const SET_THEME_MODE = '@theme/SET_MODE' as const;
export const TOGGLE_HIGH_CONTRAST = '@theme/TOGGLE_HIGH_CONTRAST' as const;
export const RESET_THEME = '@theme/RESET' as const;

/**
 * Sets the application theme mode with system preference detection support
 * @param mode - The theme mode to set (light/dark)
 * @returns A type-safe Redux action to update theme mode
 */
export const setThemeMode = (mode: ThemeMode): ThemeAction => {
  // Validate theme mode against enum
  if (!Object.values(ThemeMode).includes(mode)) {
    throw new Error(`Invalid theme mode: ${mode}`);
  }

  return {
    type: SET_THEME_MODE,
    payload: mode
  } as const;
};

/**
 * Toggles high contrast mode for WCAG 2.1 Level AA compliance
 * Switches between standard and high contrast color schemes
 * @returns A type-safe Redux action to toggle high contrast mode
 */
export const toggleHighContrast = (): ThemeAction => {
  return {
    type: TOGGLE_HIGH_CONTRAST
  } as const;
};

/**
 * Resets theme settings to system defaults
 * Restores default theme mode, contrast settings, and color schemes
 * @returns A type-safe Redux action to reset theme settings
 */
export const resetTheme = (): ThemeAction => {
  return {
    type: RESET_THEME
  } as const;
};

/**
 * Type guard to check if an action is a valid theme action
 * @param action - The action to check
 * @returns True if the action is a valid theme action
 */
export const isThemeAction = (action: unknown): action is ThemeAction => {
  if (typeof action !== 'object' || action === null) {
    return false;
  }

  const { type } = action as { type: string };
  return [
    SET_THEME_MODE,
    TOGGLE_HIGH_CONTRAST,
    RESET_THEME
  ].includes(type);
};

/**
 * Type assertions for action creators to ensure type safety
 */
export type ThemeActionCreators = {
  setThemeMode: typeof setThemeMode;
  toggleHighContrast: typeof toggleHighContrast;
  resetTheme: typeof resetTheme;
};