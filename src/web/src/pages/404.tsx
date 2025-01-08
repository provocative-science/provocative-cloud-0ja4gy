import React from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import { Box, Typography, Container, useTheme, useMediaQuery } from '@mui/material'; // ^5.0.0
import MainLayout from '../layouts/MainLayout';
import Button from '../components/common/Button';

/**
 * 404 error page component with responsive layout, accessibility features, and theme support
 * Implements Z-pattern layout and WCAG 2.1 Level AA compliance
 */
const NotFoundPage: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Handle navigation back with error handling
  const handleGoBack = (): void => {
    try {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Navigation error:', error);
      navigate('/');
    }
  };

  // Handle navigation to home
  const handleGoHome = (): void => {
    navigate('/');
  };

  return (
    <MainLayout
      hideFooter={false}
      layoutPattern="z-pattern"
      contentPadding={true}
      maxWidth="lg"
    >
      <Container
        maxWidth="md"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          py: { xs: 4, sm: 6, md: 8 }
        }}
      >
        {/* Error Code - Top Left in Z-pattern */}
        <Typography
          variant="h1"
          component="h1"
          sx={{
            fontSize: { xs: '4rem', sm: '6rem', md: '8rem' },
            fontWeight: 700,
            color: 'primary.main',
            mb: 2
          }}
          aria-label="Error 404"
        >
          404
        </Typography>

        {/* Main Message - Center in Z-pattern */}
        <Typography
          variant="h2"
          component="h2"
          sx={{
            fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
            fontWeight: 600,
            mb: 2
          }}
        >
          Page Not Found
        </Typography>

        {/* Description - Following Z-pattern */}
        <Typography
          variant="body1"
          sx={{
            fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' },
            color: 'text.secondary',
            maxWidth: '600px',
            mb: 4
          }}
        >
          The page you are looking for might have been removed, had its name changed,
          or is temporarily unavailable.
        </Typography>

        {/* Action Buttons - Bottom Right in Z-pattern */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: 2,
            width: '100%',
            maxWidth: '400px'
          }}
        >
          <Button
            variant="primary"
            size="large"
            fullWidth={isMobile}
            onClick={handleGoBack}
            ariaLabel="Go back to previous page"
          >
            Go Back
          </Button>

          <Button
            variant="secondary"
            size="large"
            fullWidth={isMobile}
            onClick={handleGoHome}
            ariaLabel="Return to home page"
          >
            Go Home
          </Button>
        </Box>
      </Container>
    </MainLayout>
  );
});

NotFoundPage.displayName = 'NotFoundPage';

export default NotFoundPage;