import React, { useCallback } from 'react';
import { Box, Typography, Container } from '@mui/material'; // ^5.0.0
import { useRouter } from 'next/router'; // ^13.0.0
import { useTheme } from '@mui/material/styles'; // ^5.0.0

import Layout from '../components/common/Layout';
import Button from '../components/common/Button';

/**
 * Enhanced 500 error page component with accessibility and responsive design
 * Implements WCAG 2.1 Level AA compliance with proper ARIA attributes
 */
const InternalServerError: React.FC = () => {
  const router = useRouter();
  const theme = useTheme();

  /**
   * Handles accessible navigation back to the home page
   */
  const handleReturnHome = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    router.push('/');
  }, [router]);

  return (
    <Layout withFooter>
      <Container maxWidth="lg">
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="60vh"
          textAlign="center"
          role="main"
          aria-labelledby="error-title"
        >
          {/* Error Status */}
          <Typography
            variant="h1"
            component="h1"
            id="error-title"
            sx={{
              fontSize: {
                xs: '3rem',
                sm: '4rem',
                md: '5rem'
              },
              color: theme.palette.error.main,
              mb: 2
            }}
          >
            500
          </Typography>

          {/* Primary Error Message */}
          <Typography
            variant="h2"
            component="h2"
            sx={{
              fontSize: {
                xs: '1.5rem',
                sm: '2rem',
                md: '2.5rem'
              },
              mb: 3
            }}
          >
            Internal Server Error
          </Typography>

          {/* Detailed Error Message */}
          <Typography
            variant="body1"
            sx={{
              fontSize: {
                xs: '1rem',
                sm: '1.1rem',
                md: '1.25rem'
              },
              maxWidth: '600px',
              mb: 4,
              color: theme.palette.text.secondary
            }}
          >
            We apologize, but something went wrong on our end. Our team has been
            notified and is working to resolve the issue. Please try again later.
          </Typography>

          {/* Technical Context (for developers) */}
          <Typography
            variant="body2"
            component="code"
            sx={{
              display: 'block',
              bgcolor: theme.palette.background.paper,
              p: 2,
              borderRadius: 1,
              mb: 4,
              fontFamily: 'monospace',
              maxWidth: '100%',
              overflow: 'auto'
            }}
          >
            Error Code: 500 | Timestamp: {new Date().toISOString()}
          </Typography>

          {/* Action Button */}
          <Button
            variant="primary"
            size="large"
            onClick={handleReturnHome}
            ariaLabel="Return to homepage"
            sx={{ minWidth: 200 }}
          >
            Return to Homepage
          </Button>
        </Box>
      </Container>
    </Layout>
  );
};

export default InternalServerError;