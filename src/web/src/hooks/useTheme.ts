/**
 * Custom React hook for managing application theme state
 * Implements theme mode switching, high contrast mode, system preference detection,
 * and theme persistence with WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  ThemeState,
  ThemeMode,
  LIGHT_THEME_COLORS,
  DARK_THEME_COLORS,
  HIGH_CONTRAST_COLORS
} from '../../types/theme';
import {
  setThemeMode,
  toggleHighContrast,
  resetTheme
} from '../../store/actions/theme';

// Storage keys for theme preferences
const STORAGE_THEME_KEY = 'provocative_cloud_theme';
const STORAGE_CONTRAST_KEY = 'provocative_cloud_contrast';

/**
 * Type for the useTheme hook return value
 */
interface UseThemeReturn {
  theme: ThemeState;
  setMode: (mode: ThemeMode) => void;
  toggleContrast: () => void;
  reset: () => void;
}

/**
 * Custom hook for managing application theme state with system preference detection
 * @returns Object containing theme state and management functions
 */
export const useTheme = (): UseThemeReturn => {
  const dispatch = useDispatch();
  const theme = useSelector((state: { theme: ThemeState }) => state.theme);

  /**
   * Sets theme mode with validation and persistence
   * @param mode - The theme mode to set
   */
  const setMode = (mode: ThemeMode): void => {
    try {
      // Validate mode
      if (!Object.values(ThemeMode).includes(mode)) {
        throw new Error(`Invalid theme mode: ${mode}`);
      }

      // Dispatch theme change
      dispatch(setThemeMode(mode));

      // Persist preference
      localStorage.setItem(STORAGE_THEME_KEY, mode);

      // Log for analytics
      console.info(`Theme mode changed to: ${mode}`);
    } catch (error) {
      console.error('Failed to set theme mode:', error);
    }
  };

  /**
   * Toggles high contrast mode with accessibility validation
   */
  const toggleContrast = (): void => {
    try {
      dispatch(toggleHighContrast());
      localStorage.setItem(STORAGE_CONTRAST_KEY, (!theme.highContrast).toString());

      // Update ARIA attributes for screen readers
      document.documentElement.setAttribute(
        'data-high-contrast',
        (!theme.highContrast).toString()
      );

      console.info('High contrast mode toggled:', !theme.highContrast);
    } catch (error) {
      console.error('Failed to toggle contrast mode:', error);
    }
  };

  /**
   * Resets theme settings to defaults with cleanup
   */
  const reset = (): void => {
    try {
      dispatch(resetTheme());
      localStorage.removeItem(STORAGE_THEME_KEY);
      localStorage.removeItem(STORAGE_CONTRAST_KEY);
      
      // Reset ARIA attributes
      document.documentElement.removeAttribute('data-high-contrast');
      
      console.info('Theme settings reset to defaults');
    } catch (error) {
      console.error('Failed to reset theme:', error);
    }
  };

  /**
   * System theme preference detection and cleanup
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (e: MediaQueryListEvent): void => {
      const systemTheme = e.matches ? ThemeMode.DARK : ThemeMode.LIGHT;
      const storedTheme = localStorage.getItem(STORAGE_THEME_KEY) as ThemeMode;

      // Only update if no stored preference exists
      if (!storedTheme) {
        setMode(systemTheme);
      }
    };

    // Initial system preference check
    if (!localStorage.getItem(STORAGE_THEME_KEY)) {
      setMode(mediaQuery.matches ? ThemeMode.DARK : ThemeMode.LIGHT);
    }

    // Set up system preference listener
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    // Restore high contrast preference
    const storedContrast = localStorage.getItem(STORAGE_CONTRAST_KEY);
    if (storedContrast && storedContrast !== theme.highContrast.toString()) {
      toggleContrast();
    }

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  /**
   * Apply theme changes to document
   */
  useEffect(() => {
    const colors = theme.highContrast
      ? HIGH_CONTRAST_COLORS[theme.mode]
      : theme.mode === ThemeMode.LIGHT
      ? LIGHT_THEME_COLORS
      : DARK_THEME_COLORS;

    // Apply theme colors to CSS variables
    Object.entries(colors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--color-${key}`, value);
    });

    // Update color scheme meta tag
    document
      .querySelector('meta[name="color-scheme"]')
      ?.setAttribute('content', theme.mode);
  }, [theme.mode, theme.highContrast]);

  return {
    theme,
    setMode,
    toggleContrast,
    reset
  };
};