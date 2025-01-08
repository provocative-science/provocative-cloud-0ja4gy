import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { format, parseISO } from 'date-fns'; // ^2.30.0
import { debounce } from 'lodash'; // ^4.17.21

import Table from '../common/Table';
import { Transaction, TransactionStatus, Currency } from '../../types/billing';
import { useBilling } from '../../hooks/useBilling';
import { useWebSocket } from '../../hooks/useWebSocket';

interface TransactionHistoryProps {
  pageSize?: number;
  className?: string;
  initialFilters?: TransactionFilters;
  onFilterChange?: (filters: TransactionFilters) => void;
  enableRealTimeUpdates?: boolean;
}

interface TransactionFilters {
  dateRange?: { start: Date; end: Date };
  status?: TransactionStatus[];
  amountRange?: { min: number; max: number };
}

const formatAmount = (amount: number, currency: Currency = Currency.USD, locale: string = 'en-US'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatDate = (date: Date | string, locale: string = 'en-US'): string => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, 'PPpp', { locale });
};

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  pageSize = 10,
  className,
  initialFilters = {},
  onFilterChange,
  enableRealTimeUpdates = true
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [sortColumn, setSortColumn] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { 
    loading,
    error,
    fetchTransactions,
    clearError
  } = useBilling({ pageSize });

  const { subscribe, unsubscribe } = useWebSocket({
    autoConnect: enableRealTimeUpdates,
    onMessage: (message) => {
      if (message.type === 'transaction_update') {
        void fetchTransactions(currentPage);
      }
    }
  });

  // Memoized table columns configuration
  const columns = useMemo(() => [
    {
      key: 'id',
      header: 'Transaction ID',
      width: '200px',
      render: (value: string) => (
        <span className="font-mono text-sm" title={value}>
          {value.slice(0, 8)}...
        </span>
      )
    },
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      width: '180px',
      render: (value: string) => formatDate(value)
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      width: '120px',
      render: (value: number) => formatAmount(value)
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: '120px',
      render: (value: TransactionStatus) => (
        <div className={`status status--${value.toLowerCase()}`}>
          {value}
        </div>
      )
    },
    {
      key: 'description',
      header: 'Description',
      render: (value: string) => (
        <div className="description" title={value}>
          {value}
        </div>
      )
    }
  ], []);

  // Debounced filter handler
  const handleFilterChange = useCallback(
    debounce((newFilters: TransactionFilters) => {
      setFilters(newFilters);
      setCurrentPage(1);
      onFilterChange?.(newFilters);
      void fetchTransactions(1);
    }, 300),
    [fetchTransactions, onFilterChange]
  );

  // Handle page changes
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    void fetchTransactions(page);
  }, [fetchTransactions]);

  // Handle sorting
  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
    void fetchTransactions(currentPage);
  }, [currentPage, fetchTransactions]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (enableRealTimeUpdates) {
      void subscribe('transactions');
    }
    return () => {
      if (enableRealTimeUpdates) {
        void unsubscribe('transactions');
      }
    };
  }, [enableRealTimeUpdates, subscribe, unsubscribe]);

  // Clear error on unmount
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  return (
    <div className={`transaction-history ${className || ''}`}>
      {error && (
        <div className="error-message" role="alert">
          {error.message}
        </div>
      )}
      
      <Table
        columns={columns}
        data={[]}
        loading={loading}
        pagination
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onSort={handleSort}
        className="transaction-table"
        ariaLabel="Transaction history table"
      />

      <style jsx>{`
        .transaction-history {
          width: 100%;
          background-color: var(--background-light);
          border-radius: var(--border-radius-md);
          overflow: hidden;
        }

        .error-message {
          padding: var(--spacing-md);
          margin-bottom: var(--spacing-md);
          background-color: var(--error-light);
          color: var(--error-dark);
          border-radius: var(--border-radius-sm);
        }

        .status {
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--border-radius-sm);
          font-weight: 500;
          text-align: center;
          transition: background-color 0.3s ease;
        }

        .status--success {
          background-color: var(--success-light);
          color: var(--success-dark);
        }

        .status--pending {
          background-color: var(--warning-light);
          color: var(--warning-dark);
        }

        .status--failed {
          background-color: var(--error-light);
          color: var(--error-dark);
        }

        .description {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 300px;
        }

        @media (max-width: 768px) {
          .transaction-history {
            border-radius: 0;
          }

          .status {
            padding: var(--spacing-xxs) var(--spacing-xs);
            font-size: 0.875rem;
          }

          .description {
            max-width: 200px;
          }
        }

        :global([data-theme='dark']) .transaction-history {
          background-color: var(--background-dark);
        }
      `}</style>
    </div>
  );
};

export default React.memo(TransactionHistory);