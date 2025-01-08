import React, { memo, useCallback, useMemo, useState } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { Pagination } from './Pagination';
import Loading from './Loading';
import { SortDirection } from '../../types/common';
import '../../styles/theme.css';

export interface TableColumn<T = any> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  ariaLabel?: string;
  ariaSort?: 'none' | 'ascending' | 'descending';
  render?: (value: any, row: T) => React.ReactNode;
}

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  pagination?: boolean;
  currentPage?: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onSort?: (key: string, direction: SortDirection) => void;
  className?: string;
  highContrast?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

const Table = memo(<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  pagination = false,
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onSort,
  className,
  highContrast = false,
  ariaLabel = 'Data table',
  ariaLabelledBy
}: TableProps<T>) => {
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.ASC);

  // Memoized table classes
  const tableClasses = useMemo(() => 
    classNames(
      'table',
      {
        'table--high-contrast': highContrast,
        'table--loading': loading
      },
      className
    ),
    [highContrast, loading, className]
  );

  // Handle sort click with keyboard support
  const handleSort = useCallback((columnKey: string, event?: React.KeyboardEvent) => {
    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable || loading) return;

    if (event && !['Enter', ' '].includes(event.key)) return;
    event?.preventDefault();

    const newDirection = columnKey === sortColumn && sortDirection === SortDirection.ASC
      ? SortDirection.DESC
      : SortDirection.ASC;

    setSortColumn(columnKey);
    setSortDirection(newDirection);
    onSort?.(columnKey, newDirection);

    // Announce sort change to screen readers
    const sortAnnouncement = `Table sorted by ${column.header} in ${newDirection === SortDirection.ASC ? 'ascending' : 'descending'} order`;
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = sortAnnouncement;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, [columns, sortColumn, sortDirection, onSort, loading]);

  // Render table header
  const renderHeader = useCallback(() => (
    <thead className="table__header">
      <tr>
        {columns.map(column => {
          const isSorted = column.key === sortColumn;
          const ariaSort = isSorted
            ? sortDirection === SortDirection.ASC ? 'ascending' : 'descending'
            : 'none';

          return (
            <th
              key={column.key}
              className={classNames('table__header-cell', {
                'table__header-cell--sortable': column.sortable,
                'table__header-cell--sorted': isSorted
              })}
              style={{ width: column.width }}
              scope="col"
              aria-sort={column.sortable ? ariaSort : undefined}
              role={column.sortable ? 'columnheader button' : 'columnheader'}
              tabIndex={column.sortable ? 0 : undefined}
              onClick={() => column.sortable && handleSort(column.key)}
              onKeyDown={(e) => column.sortable && handleSort(column.key, e)}
            >
              <div className="table__header-content">
                <span>{column.header}</span>
                {column.sortable && (
                  <span className="table__sort-icon" aria-hidden="true">
                    {isSorted ? (sortDirection === SortDirection.ASC ? '↑' : '↓') : '↕'}
                  </span>
                )}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  ), [columns, sortColumn, sortDirection, handleSort]);

  // Render table rows
  const renderRows = useCallback(() => (
    <tbody className="table__body">
      {data.map((row, rowIndex) => (
        <tr
          key={rowIndex}
          className="table__row"
          role="row"
        >
          {columns.map((column, cellIndex) => (
            <td
              key={`${rowIndex}-${column.key}`}
              className="table__cell"
              role="cell"
              data-label={column.header}
            >
              {column.render ? column.render(row[column.key], row) : row[column.key]}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  ), [data, columns]);

  return (
    <div className="table-container" role="region" aria-label={ariaLabel}>
      <table
        className={tableClasses}
        role="table"
        aria-busy={loading}
        aria-labelledby={ariaLabelledBy}
      >
        {renderHeader()}
        {!loading && renderRows()}
      </table>

      {loading && (
        <div className="table__loading">
          <Loading
            size="lg"
            overlay={false}
            text="Loading data..."
            ariaLabel="Loading table data"
          />
        </div>
      )}

      {!loading && data.length === 0 && (
        <div
          className="table__empty"
          role="status"
          aria-live="polite"
        >
          No data available
        </div>
      )}

      {pagination && totalItems > pageSize && (
        <div className="table__pagination">
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={onPageChange}
            ariaLabel="Table navigation"
          />
        </div>
      )}

      <style jsx>{`
        .table-container {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid var(--border-light);
          border-radius: var(--border-radius-md);
          transition: var(--transition-normal);
        }

        .table__header-cell {
          padding: var(--spacing-sm);
          background: var(--background-light);
          border-bottom: 2px solid var(--border-light);
          font-weight: var(--font-weight-semibold);
          text-align: left;
          transition: var(--transition-normal);
        }

        .table__header-cell--sortable {
          cursor: pointer;
          user-select: none;
        }

        .table__header-cell--sortable:hover {
          background: var(--background-dark);
          color: var(--primary-text-dark);
        }

        .table__header-content {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .table__sort-icon {
          font-size: var(--font-size-sm);
          opacity: 0.5;
        }

        .table__cell {
          padding: var(--spacing-sm);
          border-bottom: 1px solid var(--border-light);
          transition: var(--transition-normal);
        }

        .table__row:last-child .table__cell {
          border-bottom: none;
        }

        .table__loading,
        .table__empty {
          padding: var(--spacing-xl);
          text-align: center;
          color: var(--secondary-text-light);
        }

        .table__pagination {
          margin-top: var(--spacing-md);
        }

        /* High Contrast Theme */
        .table--high-contrast {
          border-color: var(--high-contrast-light);
        }

        .table--high-contrast .table__header-cell {
          background: var(--high-contrast-light);
          color: var(--high-contrast-dark);
          border-color: var(--high-contrast-light);
        }

        .table--high-contrast .table__cell {
          border-color: var(--high-contrast-light);
        }

        /* Responsive Design */
        @media (max-width: var(--breakpoint-tablet)) {
          .table__cell {
            display: flex;
            padding: var(--spacing-xs);
          }

          .table__cell::before {
            content: attr(data-label);
            font-weight: var(--font-weight-semibold);
            margin-right: var(--spacing-sm);
          }
        }

        /* Dark Theme */
        :global([data-theme='dark']) .table {
          border-color: var(--border-dark);
        }

        :global([data-theme='dark']) .table__header-cell {
          background: var(--background-dark);
          border-color: var(--border-dark);
          color: var(--primary-text-dark);
        }

        :global([data-theme='dark']) .table__cell {
          border-color: var(--border-dark);
          color: var(--primary-text-dark);
        }

        /* Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .table,
          .table__header-cell,
          .table__cell {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
});

Table.displayName = 'Table';

export default Table;