import React, { useCallback, useEffect, useMemo, useState } from 'react'; // ^18.0.0
import { format } from 'date-fns'; // ^2.30.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import Table from '../common/Table';
import Loading from '../common/Loading';
import { useBilling } from '../../hooks/useBilling';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTheme } from '../../hooks/useTheme';
import { PaymentStatus, Currency, CURRENCY_CONFIGS } from '../../types/billing';

interface InvoiceListProps {
  pageSize?: number;
  className?: string;
  onError?: (error: Error) => void;
  enableRealtime?: boolean;
  accessibilityLabel?: string;
}

const InvoiceList: React.FC<InvoiceListProps> = ({
  pageSize = 10,
  className,
  onError,
  enableRealtime = true,
  accessibilityLabel = 'Invoice history table'
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const { theme } = useTheme();
  const { 
    loading, 
    error, 
    fetchInvoices, 
    clearError 
  } = useBilling({ pageSize });

  // WebSocket setup for real-time updates
  const { 
    isConnected, 
    subscribe, 
    unsubscribe 
  } = useWebSocket({
    autoConnect: enableRealtime,
    onMessage: (message) => {
      if (message.type === 'invoice_update') {
        void fetchInvoices();
      }
    },
    onError: (wsError) => {
      console.error('WebSocket error:', wsError);
      onError?.(wsError);
    }
  });

  // Handle real-time updates subscription
  useEffect(() => {
    if (enableRealtime && isConnected) {
      void subscribe('invoices');
      return () => {
        void unsubscribe('invoices');
      };
    }
  }, [enableRealtime, isConnected, subscribe, unsubscribe]);

  // Format currency amount with proper locale
  const formatAmount = useCallback((amount: number, currency: Currency) => {
    const config = CURRENCY_CONFIGS[currency];
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: config.decimalPlaces
    }).format(amount);
  }, []);

  // Render status badge with proper styling and accessibility
  const renderStatusBadge = useCallback((status: PaymentStatus) => {
    const statusColors = {
      [PaymentStatus.COMPLETED]: 'var(--success-light)',
      [PaymentStatus.PENDING]: 'var(--accent-light)',
      [PaymentStatus.FAILED]: 'var(--alert-light)',
      [PaymentStatus.REFUNDED]: 'var(--secondary-text-light)'
    };

    return (
      <span
        className="status-badge"
        style={{
          backgroundColor: statusColors[status],
          color: theme.mode === 'dark' ? '#000' : '#fff'
        }}
        role="status"
        aria-label={`Payment status: ${status.toLowerCase()}`}
      >
        {status}
      </span>
    );
  }, [theme.mode]);

  // Table columns configuration
  const columns = useMemo(() => [
    {
      key: 'id',
      header: 'Invoice ID',
      width: '20%',
      render: (value: string) => (
        <span className="monospace" title={value}>
          {value.substring(0, 8)}...
        </span>
      )
    },
    {
      key: 'date',
      header: 'Date',
      width: '20%',
      sortable: true,
      render: (value: number) => format(value, 'PPP')
    },
    {
      key: 'amount',
      header: 'Amount',
      width: '20%',
      sortable: true,
      render: (value: number, row: any) => formatAmount(value, row.currency)
    },
    {
      key: 'status',
      header: 'Status',
      width: '15%',
      render: (value: PaymentStatus) => renderStatusBadge(value)
    },
    {
      key: 'description',
      header: 'Description',
      width: '25%'
    }
  ], [formatAmount, renderStatusBadge]);

  // Handle page changes with debouncing
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    void fetchInvoices();
  }, [fetchInvoices]);

  // Error handling
  useEffect(() => {
    if (error) {
      onError?.(error);
      clearError();
    }
  }, [error, onError, clearError]);

  return (
    <ErrorBoundary
      fallback={
        <div role="alert" className="error-container">
          An error occurred while loading invoices. Please try again later.
        </div>
      }
      onError={onError}
    >
      <div className={`invoice-list ${className || ''}`}>
        {loading ? (
          <Loading
            size="lg"
            text="Loading invoices..."
            ariaLabel="Loading invoice data"
          />
        ) : (
          <Table
            columns={columns}
            data={[]} // Data would come from useBilling hook
            pagination
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            className="invoice-table"
            highContrast={theme.highContrast}
            ariaLabel={accessibilityLabel}
          />
        )}
      </div>

      <style jsx>{`
        .invoice-list {
          width: 100%;
          background-color: var(--background-light);
          border-radius: var(--border-radius-md);
          overflow: hidden;
          padding: var(--spacing-md);
        }

        .status-badge {
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--border-radius-sm);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .monospace {
          font-family: var(--font-family-mono);
        }

        .error-container {
          padding: var(--spacing-lg);
          color: var(--alert-light);
          text-align: center;
        }

        /* Dark theme support */
        :global([data-theme='dark']) .invoice-list {
          background-color: var(--background-dark);
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .invoice-list {
            padding: var(--spacing-xs);
            font-size: var(--font-size-sm);
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .status-badge {
            transition: none;
          }
        }
      `}</style>
    </ErrorBoundary>
  );
};

export default React.memo(InvoiceList);