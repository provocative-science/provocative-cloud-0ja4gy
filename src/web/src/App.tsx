import React, { Suspense, memo, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'; // ^6.11.0
import { Provider } from 'react-redux'; // ^8.0.5
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material'; // ^5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

// Internal imports
import { routes } from './config/routes';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { store } from './store';
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import { analytics } from './utils/analytics';

// Error boundary fallback component
const ErrorFallback = memo(({ error }: { error: Error }) => (
  <div role="alert" className="error-boundary">
    <h2>Application Error</h2>
    <pre>{error.message}</pre>
    <button onClick={() => window.location.reload()}>
      Refresh Application
    </button>
  </div>
));

ErrorFallback.displayName = 'ErrorFallback';

// Loading fallback component
const LoadingFallback = memo(() => (
  <div 
    role="progressbar" 
    aria-busy="true" 
    aria-label="Loading application"
    className="loading-fallback"
  >
    Loading...
  </div>
));

LoadingFallback.displayName = 'LoadingFallback';

// Route change tracker component
const RouteTracker = memo(() => {
  const navigate = useNavigate();

  useEffect(() => {
    // Track page views
    const handleRouteChange = (location: Location) => {
      analytics.track('page_view', {
        path: location.pathname,
        search: location.search,
        title: document.title,
        timestamp: new Date().toISOString()
      });
    };

    // Track initial page load
    handleRouteChange(window.location);

    // Set up navigation tracking
    const unlisten = navigate((location) => {
      handleRouteChange(location);
    });

    return () => {
      unlisten();
    };
  }, [navigate]);

  return null;
});

RouteTracker.displayName = 'RouteTracker';

// Enhanced App component with security, accessibility, and performance features
const App: React.FC = memo(() => {
  const { theme, setMode } = useTheme();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const { isAuthenticated } = useAuth();

  // Sync theme with system preferences
  useEffect(() => {
    if (!localStorage.getItem('theme_preference')) {
      setMode(prefersDarkMode ? 'dark' : 'light');
    }
  }, [prefersDarkMode, setMode]);

  // Set security headers
  useEffect(() => {
    // Set Content Security Policy
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      connect-src 'self' https://api.provocative.cloud;
      font-src 'self';
      frame-src 'none';
      object-src 'none';
    `;
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <BrowserRouter>
            <RouteTracker />
            <Suspense fallback={<LoadingFallback />}>
              <MainLayout>
                <Routes>
                  {routes.map(({ path, component: Component, roles, metadata }) => (
                    <Route
                      key={path}
                      path={path}
                      element={
                        roles ? (
                          <ProtectedRoute requiredRole={roles[0]}>
                            <Component />
                          </ProtectedRoute>
                        ) : (
                          <Component />
                        )
                      }
                    />
                  ))}
                  
                  {/* Catch-all route for 404 */}
                  <Route 
                    path="*" 
                    element={
                      <Navigate 
                        to="/404" 
                        replace 
                        state={{ from: location.pathname }} 
                      />
                    } 
                  />
                </Routes>
              </MainLayout>
            </Suspense>
          </BrowserRouter>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
});

App.displayName = 'App';

export default App;