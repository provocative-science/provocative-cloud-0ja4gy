import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, Tab, Box, Container, CircularProgress, Fade } from '@mui/material';
import { useMediaQuery } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import Analytics from '@segment/analytics-next';

import DashboardLayout from '../../layouts/DashboardLayout';
import ProfileSettings from '../../components/settings/ProfileSettings';
import SecuritySettings from '../../components/settings/SecuritySettings';
import ThemeSettings from '../../components/settings/ThemeSettings';

// Initialize analytics
const analytics = new Analytics({
  writeKey: process.env.REACT_APP_SEGMENT_WRITE_KEY || ''
});

// Interface for tab panel props
interface SettingsTabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
  loading?: boolean;
  error?: Error | null;
}

/**
 * TabPanel component for rendering settings content with loading and error states
 */
const TabPanel: React.FC<SettingsTabPanelProps> = ({
  children,
  value,
  index,
  loading = false,
  error = null
}) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
    >
      <Fade in={value === index}>
        <Box sx={{ p: 3 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box 
              sx={{ 
                p: 2, 
                color: 'error.main',
                border: 1,
                borderColor: 'error.main',
                borderRadius: 1
              }}
            >
              {error.message}
            </Box>
          ) : (
            children
          )}
        </Box>
      </Fade>
    </div>
  );
};

/**
 * Settings page component providing comprehensive user settings management
 * Implements responsive design, analytics tracking, and accessibility features
 */
const Settings: React.FC = () => {
  // State management
  const [tabValue, setTabValue] = useState(() => {
    return parseInt(localStorage.getItem('settings_tab') || '0', 10);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Responsive layout detection
  const isMobile = useMediaQuery('(max-width:768px)');

  // Handle tab changes with analytics tracking
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    localStorage.setItem('settings_tab', newValue.toString());

    // Track tab change in analytics
    analytics.track('Settings Tab Changed', {
      tabIndex: newValue,
      tabName: ['Profile', 'Security', 'Theme'][newValue],
      timestamp: new Date().toISOString()
    });
  }, []);

  // Update document title based on active tab
  useEffect(() => {
    const titles = ['Profile Settings', 'Security Settings', 'Theme Settings'];
    document.title = `${titles[tabValue]} - Provocative Cloud`;
  }, [tabValue]);

  // Error boundary fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <Box p={3} textAlign="center">
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
    </Box>
  );

  return (
    <DashboardLayout>
      <Container maxWidth="lg">
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => {
            setError(null);
            setLoading(false);
          }}
        >
          <Box sx={{ width: '100%', mt: 3 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                aria-label="Settings tabs"
                variant={isMobile ? 'fullWidth' : 'standard'}
                centered={!isMobile}
              >
                <Tab 
                  label="Profile" 
                  id="settings-tab-0"
                  aria-controls="settings-tabpanel-0"
                />
                <Tab 
                  label="Security" 
                  id="settings-tab-1"
                  aria-controls="settings-tabpanel-1"
                />
                <Tab 
                  label="Theme" 
                  id="settings-tab-2"
                  aria-controls="settings-tabpanel-2"
                />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0} loading={loading} error={error}>
              <ProfileSettings
                onUpdateSuccess={() => {
                  analytics.track('Profile Settings Updated');
                }}
              />
            </TabPanel>

            <TabPanel value={tabValue} index={1} loading={loading} error={error}>
              <SecuritySettings />
            </TabPanel>

            <TabPanel value={tabValue} index={2} loading={loading} error={error}>
              <ThemeSettings />
            </TabPanel>
          </Box>
        </ErrorBoundary>
      </Container>
    </DashboardLayout>
  );
};

export default Settings;