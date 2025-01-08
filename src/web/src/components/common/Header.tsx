import React, { useEffect, useCallback, memo } from 'react';
import {
  AppBar,
  Box,
  Container,
  useMediaQuery,
  Skeleton,
  CircularProgress
} from '@mui/material'; // ^5.0.0
import { useTheme as useMuiTheme } from '@mui/material/styles'; // ^5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import Analytics from '@analytics/react'; // ^0.1.0

import Navbar from './Navbar';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

// Constants for header dimensions and transitions
const HEADER_HEIGHT = 64;
const MOBILE_HEADER_HEIGHT = 56;
const THEME_TRANSITION_DURATION = 300;

// Analytics events
const ANALYTICS_EVENTS = {
  THEME_CHANGE: 'theme_changed',
  HEADER_INTERACTION: 'header_interaction'
} as const;

// Initialize analytics
const analytics = new Analytics({
  app: 'provocative-cloud',
  version: '1.0.0',
  debug: process.env.NODE_ENV === 'development'
});

/**
 * Error fallback component for header errors
 */
const HeaderErrorFallback = memo(({ error }: { error: Error }) => (
  <AppBar 
    position="fixed" 
    sx={{ 
      bgcolor: 'error.main',
      height: HEADER_HEIGHT,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}
  >
    <Box component="span" sx={{ color: 'error.contrastText' }}>
      {error.message || 'An error occurred in the header'}
    </Box>
  </AppBar>
));

HeaderErrorFallback.displayName = 'HeaderErrorFallback';

/**
 * Main header component with responsive design and theme support
 * Implements WCAG 2.1 Level AA compliance
 */
const Header: React.FC = memo(() => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { theme, setMode, toggleContrast } = useTheme();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  /**
   * Handles theme mode changes with analytics tracking
   */
  const handleThemeToggle = useCallback(() => {
    const newMode = theme.mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    
    analytics.track(ANALYTICS_EVENTS.THEME_CHANGE, {
      mode: newMode,
      timestamp: new Date().toISOString()
    });
  }, [theme.mode, setMode]);

  /**
   * Updates document meta theme-color based on current theme
   */
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        theme.mode === 'light' ? '#FFFFFF' : '#1A1A1A'
      );
    }
  }, [theme.mode]);

  /**
   * Renders loading state while authentication is pending
   */
  if (isLoading) {
    return (
      <AppBar
        position="fixed"
        sx={{
          height: isMobile ? MOBILE_HEADER_HEIGHT : HEADER_HEIGHT,
          transition: `all ${THEME_TRANSITION_DURATION}ms ease-in-out`
        }}
      >
        <Container maxWidth="lg">
          <Box display="flex" alignItems="center" height="100%">
            <Skeleton variant="rectangular" width={150} height={32} />
            <Box flexGrow={1} />
            <CircularProgress size={24} color="inherit" />
          </Box>
        </Container>
      </AppBar>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={HeaderErrorFallback}>
      <AppBar
        position="fixed"
        color="inherit"
        sx={{
          height: isMobile ? MOBILE_HEADER_HEIGHT : HEADER_HEIGHT,
          bgcolor: 'background.paper',
          transition: `all ${THEME_TRANSITION_DURATION}ms ease-in-out`,
          borderBottom: 1,
          borderColor: 'divider'
        }}
        role="banner"
        aria-label="Main header"
      >
        <Container 
          maxWidth="lg"
          sx={{
            height: '100%',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Navbar
            onThemeToggle={handleThemeToggle}
            isDarkMode={theme.mode === 'dark'}
            isHighContrast={theme.highContrast}
            onContrastToggle={toggleContrast}
          />
        </Container>
      </AppBar>
      {/* Spacer to prevent content from hiding under fixed header */}
      <Box 
        height={isMobile ? MOBILE_HEADER_HEIGHT : HEADER_HEIGHT} 
        role="presentation"
      />
    </ErrorBoundary>
  );
});

Header.displayName = 'Header';

export default Header;