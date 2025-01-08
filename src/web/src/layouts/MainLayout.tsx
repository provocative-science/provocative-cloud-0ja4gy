import React, { useCallback, useEffect } from 'react';
import { Box, Container, useMediaQuery } from '@mui/material'; // ^5.0.0
import { useTheme as useMuiTheme } from '@mui/material/styles'; // ^5.0.0
import styled from '@emotion/styled'; // ^11.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import { useTheme } from '../hooks/useTheme';

// Constants for layout dimensions and transitions
const HEADER_HEIGHT = 64;
const MOBILE_HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 80;
const LAYOUT_TRANSITIONS = {
  duration: 200,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
};

// Styled components
const StyledMain = styled.main<{ $minHeight: string }>`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-height: ${props => props.$minHeight};
  transition: padding ${LAYOUT_TRANSITIONS.duration}ms ${LAYOUT_TRANSITIONS.easing};
  contain: layout;
  position: relative;
  width: 100%;
`;

const StyledContainer = styled(Container)<{ $hasFooter: boolean }>`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  padding-bottom: ${props => props.$hasFooter ? `${FOOTER_HEIGHT}px` : '0'};
  transition: padding ${LAYOUT_TRANSITIONS.duration}ms ${LAYOUT_TRANSITIONS.easing};
`;

// Interface for component props
interface MainLayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
  layoutPattern?: 'f-pattern' | 'z-pattern';
  contentPadding?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
}

/**
 * Main layout component providing consistent page structure with responsive design and theme support
 */
const MainLayout: React.FC<MainLayoutProps> = React.memo(({
  children,
  hideFooter = false,
  layoutPattern = 'f-pattern',
  contentPadding = true,
  maxWidth = 'lg'
}) => {
  const { theme } = useTheme();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  // Calculate dynamic content height based on header/footer presence
  const getMinHeight = useCallback(() => {
    const headerHeight = isMobile ? MOBILE_HEADER_HEIGHT : HEADER_HEIGHT;
    const footerHeight = hideFooter ? 0 : FOOTER_HEIGHT;
    return `calc(100vh - ${headerHeight}px - ${footerHeight}px)`;
  }, [isMobile, hideFooter]);

  // Apply layout pattern styles
  useEffect(() => {
    document.documentElement.setAttribute('data-layout', layoutPattern);
    return () => {
      document.documentElement.removeAttribute('data-layout');
    };
  }, [layoutPattern]);

  // Error boundary fallback
  const ErrorFallback = ({ error }: { error: Error }) => (
    <Box
      role="alert"
      sx={{
        p: 3,
        color: 'error.main',
        textAlign: 'center'
      }}
    >
      <h2>Layout Error</h2>
      <pre>{error.message}</pre>
    </Box>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'text.primary',
          transition: theme => theme.transitions.create(['background-color', 'color'], LAYOUT_TRANSITIONS)
        }}
      >
        <Header />

        <StyledMain
          $minHeight={getMinHeight()}
          role="main"
          aria-label="Main content"
        >
          <StyledContainer
            maxWidth={maxWidth}
            $hasFooter={!hideFooter}
            sx={{
              px: contentPadding ? { xs: 2, sm: 3, md: 4 } : 0,
              py: contentPadding ? { xs: 2, sm: 3, md: 4 } : 0
            }}
          >
            {children}
          </StyledContainer>
        </StyledMain>

        {!hideFooter && <Footer />}
      </Box>
    </ErrorBoundary>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;