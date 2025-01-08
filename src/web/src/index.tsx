import React, { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import App from './App';
import { store } from './store/store';
import { initializeWebSocket } from '@provocative/websocket'; // ^1.0.0
import { initializeAnalytics } from '@provocative/analytics'; // ^1.0.0

// Constants
const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL;
const NODE_ENV = process.env.NODE_ENV;

/**
 * Error boundary fallback component
 */
const ErrorFallback = ({ error }: { error: Error }) => (
  <div role="alert" className="error-boundary">
    <h2>Application Error</h2>
    <pre>{error.message}</pre>
    <button onClick={() => window.location.reload()}>
      Refresh Application
    </button>
  </div>
);

/**
 * Initializes application services like WebSocket, analytics, and monitoring
 */
const initializeApp = async (): Promise<void> => {
  try {
    // Initialize WebSocket connection for real-time updates
    if (WEBSOCKET_URL) {
      await initializeWebSocket({
        url: WEBSOCKET_URL,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
    }

    // Initialize analytics in non-development environments
    if (NODE_ENV !== 'development') {
      await initializeAnalytics({
        app: 'provocative-cloud',
        version: '1.0.0',
        environment: NODE_ENV
      });
    }

    // Register service worker for PWA support
    if ('serviceWorker' in navigator && NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(error => {
          console.error('Service worker registration failed:', error);
        });
      });
    }
  } catch (error) {
    console.error('Application initialization error:', error);
    throw error;
  }
};

/**
 * Renders the root application with all required providers
 */
const renderApp = () => {
  // Get root element with type safety check
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Create React 18 root
  const root = createRoot(rootElement);

  // Initialize application services
  initializeApp().catch(error => {
    console.error('Failed to initialize application:', error);
  });

  // Render application with providers
  root.render(
    <StrictMode>
      <ErrorBoundary 
        FallbackComponent={ErrorFallback}
        onError={(error) => {
          console.error('Application error:', error);
          // Log to error reporting service in production
          if (NODE_ENV === 'production') {
            // Error reporting implementation
          }
        }}
      >
        <Provider store={store}>
          <ThemeProvider theme={store.getState().theme}>
            <App />
          </ThemeProvider>
        </Provider>
      </ErrorBoundary>
    </StrictMode>
  );

  // Set up cleanup handlers
  window.addEventListener('unload', () => {
    // Clean up WebSocket connections
    if (WEBSOCKET_URL) {
      // WebSocket cleanup implementation
    }
  });
};

// Initialize and render application
renderApp();

// Enable hot module replacement in development
if (NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    renderApp();
  });
}