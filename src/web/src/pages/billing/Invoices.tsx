import React, { useCallback, useEffect, useState, memo } from 'react';
import { useTheme } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import Analytics from '@segment/analytics-next';

import InvoiceList from '../../components/billing/InvoiceList';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useBilling } from '../../hooks/useBilling';

// Initialize analytics
const analytics = new Analytics({
  writeKey: process.env.REACT_APP_SEGMENT_WRITE_KEY || ''
});

// Constants
const PAGE_SIZE = 10;
const ERROR_RETRY_DELAY = 3000;

/**
 * Custom hook for managing invoice WebSocket subscription
 */
const useInvoiceSubscription = () => {
  const { subscribeToInvoices } = useBilling();

  useEffect(() => {
    const subscription = subscribeToInvoices();
    return () => {
      subscription?.unsubscribe();
    };
  }, [subscribeToInvoices]);
};

/**
 * Invoices page component displaying billing history with real-time updates
 */
const InvoicesPage: React.FC = memo(() => {
  const theme = useTheme();
  const [retryCount, setRetryCount] = useState(0);
  const { invoices, loading, error } = useBilling({
    autoFetch: true,
    pageSize: PAGE_SIZE
  });

  // Set up WebSocket subscription for real-time updates
  useInvoiceSubscription();

  // Track page view
  useEffect(() => {
    analytics.track('Billing History Viewed', {
      timestamp: new Date().toISOString(),
      theme: theme.palette.mode
    });
  }, [theme.palette.mode]);

  // Handle errors with retry mechanism
  const handleError = useCallback((error: Error) => {
    console.error('Billing error:', error);
    
    analytics.track('Billing Error', {
      error: error.message,
      retryCount,
      timestamp: new Date().toISOString()
    });

    if (retryCount < 3) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, ERROR_RETRY_DELAY);
    }
  }, [retryCount]);

  // Handle page changes
  const handlePageChange = useCallback((page: number) => {
    analytics.track('Billing Page Changed', {
      page,
      timestamp: new Date().toISOString()
    });
  }, []);

  return (
    <DashboardLayout>
      <div className="invoices-container">
        <header className="invoices-header">
          <h1>Billing History</h1>
        </header>

        <ErrorBoundary
          FallbackComponent={({ error }) => (
            <div className="error-container" role="alert">
              <p>Error loading invoices: {error.message}</p>
              <button 
                onClick={() => window.location.reload()}
                className="retry-button"
              >
                Retry
              </button>
            </div>
          )}
          onError={handleError}
        >
          <InvoiceList
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
            className="invoice-list"
            enableRealtime={true}
            onError={handleError}
            accessibilityLabel="Invoice history"
          />
        </ErrorBoundary>
      </div>

      <style jsx>{`
        .invoices-container {
          padding: var(--spacing-lg);
          max-width: 1200px;
          margin: 0 auto;
          min-height: 100vh;
        }

        .invoices-header {
          margin-bottom: var(--spacing-lg);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
        }

        .invoices-header h1 {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--text-primary);
          margin: 0;
        }

        .error-container {
          color: var(--error);
          padding: var(--spacing-md);
          background-color: var(--error-light);
          border-radius: var(--border-radius-sm);
          margin-bottom: var(--spacing-md);
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .retry-button {
          padding: var(--spacing-xs) var(--spacing-sm);
          background-color: var(--background-light);
          border: 1px solid var(--error);
          border-radius: var(--border-radius-sm);
          color: var(--error);
          cursor: pointer;
          transition: var(--transition-normal);
        }

        .retry-button:hover {
          background-color: var(--error);
          color: var(--background-light);
        }

        .invoice-list {
          background-color: var(--background-light);
          border-radius: var(--border-radius-md);
          box-shadow: var(--shadow-sm);
        }

        @media (max-width: 768px) {
          .invoices-container {
            padding: var(--spacing-md);
          }

          .invoices-header {
            margin-bottom: var(--spacing-md);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .retry-button {
            transition: none;
          }
        }
      `}</style>
    </DashboardLayout>
  );
});

InvoicesPage.displayName = 'InvoicesPage';

export default InvoicesPage;