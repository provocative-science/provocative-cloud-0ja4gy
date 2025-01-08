import React, { useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { Switch, useMediaQuery } from '@mui/material';
import { toast } from 'react-toastify';
import { useTheme } from '../../hooks/useTheme';
import { ThemeMode } from '../../types/theme';
import { Card } from '../common/Card';

// Styled components with accessibility and theme support
const SettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  transition: all 0.3s ease-in-out;

  @media (prefers-reduced-motion) {
    transition: none;
  }
`;

const SettingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid ${props => props.theme.colors.border};

  &:last-child {
    border-bottom: none;
  }
`;

const SettingLabel = styled.span`
  font-size: 1rem;
  color: ${props => props.theme.colors.primaryText};
  font-weight: 500;
  user-select: none;
`;

const ResetButton = styled.button`
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: ${props => props.theme.colors.accent};
  color: #FFFFFF;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.2s ease-in-out;

  &:hover {
    opacity: 0.9;
  }

  &:focus {
    outline: 2px solid ${props => props.theme.colors.accent};
    outline-offset: 2px;
  }
`;

/**
 * Theme Settings component providing controls for theme customization
 * Implements WCAG 2.1 Level AA compliance and smooth transitions
 */
export const ThemeSettings: React.FC = () => {
  const { theme, setMode, toggleContrast, reset } = useTheme();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Handle system color scheme changes
  useEffect(() => {
    if (theme.mode === ThemeMode.SYSTEM) {
      setMode(prefersDarkMode ? ThemeMode.DARK : ThemeMode.LIGHT);
    }
  }, [prefersDarkMode, theme.mode, setMode]);

  // Handle theme mode toggle with smooth transition
  const handleThemeToggle = useCallback(() => {
    const newMode = theme.mode === ThemeMode.LIGHT ? ThemeMode.DARK : ThemeMode.LIGHT;
    
    // Add transition class for smooth theme change
    document.documentElement.classList.add('theme-transition');
    
    setMode(newMode);
    toast.success(`Theme switched to ${newMode} mode`);

    // Remove transition class after animation
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);
  }, [theme.mode, setMode]);

  // Handle high contrast toggle with accessibility considerations
  const handleContrastToggle = useCallback(() => {
    toggleContrast();
    
    // Update ARIA live region
    const message = `High contrast mode ${!theme.highContrast ? 'enabled' : 'disabled'}`;
    toast.success(message, {
      ariaLabel: message
    });

    // Log accessibility event
    console.info('Accessibility: High contrast mode toggled', !theme.highContrast);
  }, [theme.highContrast, toggleContrast]);

  // Handle theme reset with confirmation
  const handleResetTheme = useCallback(() => {
    if (window.confirm('Reset all theme settings to defaults?')) {
      reset();
      toast.success('Theme settings reset to defaults');
    }
  }, [reset]);

  return (
    <Card
      padding={24}
      role="region"
      aria-label="Theme Settings"
    >
      <SettingsContainer>
        <SettingRow>
          <SettingLabel>Dark Mode</SettingLabel>
          <Switch
            checked={theme.mode === ThemeMode.DARK}
            onChange={handleThemeToggle}
            color="primary"
            inputProps={{
              'aria-label': 'Toggle dark mode',
              role: 'switch',
              'aria-checked': theme.mode === ThemeMode.DARK
            }}
          />
        </SettingRow>

        <SettingRow>
          <SettingLabel>High Contrast</SettingLabel>
          <Switch
            checked={theme.highContrast}
            onChange={handleContrastToggle}
            color="primary"
            inputProps={{
              'aria-label': 'Toggle high contrast mode',
              role: 'switch',
              'aria-checked': theme.highContrast
            }}
          />
        </SettingRow>

        <SettingRow>
          <SettingLabel>Use System Theme</SettingLabel>
          <Switch
            checked={theme.mode === ThemeMode.SYSTEM}
            onChange={() => setMode(ThemeMode.SYSTEM)}
            color="primary"
            inputProps={{
              'aria-label': 'Use system theme preference',
              role: 'switch',
              'aria-checked': theme.mode === ThemeMode.SYSTEM
            }}
          />
        </SettingRow>

        <ResetButton
          onClick={handleResetTheme}
          aria-label="Reset theme settings to defaults"
        >
          Reset to Defaults
        </ResetButton>
      </SettingsContainer>
    </Card>
  );
};

export default ThemeSettings;