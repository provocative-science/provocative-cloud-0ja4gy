import React, { memo, useCallback, useMemo } from 'react'; // v18.0.0
import classNames from 'classnames'; // v2.3.0
import { Button } from './Button';
import { PaginationParams } from '../../types/common';

// Constants for pagination configuration
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_MAX_VISIBLE_PAGES = 5;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEBOUNCE_DELAY = 300;

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  maxVisiblePages?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
  isLoading?: boolean;
  ariaLabel?: string;
}

const calculatePageRange = (
  currentPage: number,
  totalPages: number,
  maxVisiblePages: number
): number[] => {
  // Handle edge cases
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // Calculate range boundaries
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  // Adjust range if at edges
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  // Generate page numbers array
  const pages: number[] = [];
  
  // Add first page if not in range
  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) pages.push(-1); // Add ellipsis
  }

  // Add visible page numbers
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  // Add last page if not in range
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pages.push(-1); // Add ellipsis
    pages.push(totalPages);
  }

  return pages;
};

export const Pagination = memo(({
  currentPage,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  maxVisiblePages = DEFAULT_MAX_VISIBLE_PAGES,
  onPageChange,
  onPageSizeChange,
  className,
  isLoading = false,
  ariaLabel = 'Pagination navigation'
}: PaginationProps) => {
  // Calculate total pages
  const totalPages = Math.ceil(totalItems / pageSize);

  // Memoize page range calculation
  const pageNumbers = useMemo(() => 
    calculatePageRange(currentPage, totalPages, maxVisiblePages),
    [currentPage, totalPages, maxVisiblePages]
  );

  // Debounced page change handler
  const handlePageClick = useCallback((page: number) => {
    if (page === currentPage || page < 1 || page > totalPages || isLoading) {
      return;
    }

    onPageChange(page);
  }, [currentPage, totalPages, isLoading, onPageChange]);

  // Handle page size changes
  const handlePageSizeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = parseInt(event.target.value, 10);
    if (isNaN(newPageSize) || !onPageSizeChange) return;

    // Calculate new current page to maintain approximate scroll position
    const firstItemIndex = (currentPage - 1) * pageSize;
    const newCurrentPage = Math.floor(firstItemIndex / newPageSize) + 1;
    
    onPageSizeChange(newPageSize);
    onPageChange(Math.min(newCurrentPage, Math.ceil(totalItems / newPageSize)));
  }, [currentPage, pageSize, totalItems, onPageChange, onPageSizeChange]);

  // Early return if only one page
  if (totalPages <= 1) return null;

  return (
    <nav
      className={classNames('pagination', className)}
      aria-label={ariaLabel}
      role="navigation"
    >
      <div className="pagination__controls">
        {/* Previous page button */}
        <Button
          variant="secondary"
          size="small"
          disabled={currentPage === 1 || isLoading}
          onClick={() => handlePageClick(currentPage - 1)}
          ariaLabel="Previous page"
        >
          <span aria-hidden="true">&laquo;</span>
          <span className="sr-only">Previous</span>
        </Button>

        {/* Page numbers */}
        <div className="pagination__pages" role="group" aria-label="Page numbers">
          {pageNumbers.map((pageNum, index) => (
            pageNum === -1 ? (
              <span
                key={`ellipsis-${index}`}
                className="pagination__ellipsis"
                aria-hidden="true"
              >
                &hellip;
              </span>
            ) : (
              <Button
                key={pageNum}
                variant={pageNum === currentPage ? 'primary' : 'secondary'}
                size="small"
                disabled={isLoading}
                onClick={() => handlePageClick(pageNum)}
                ariaLabel={`Page ${pageNum}`}
                aria-current={pageNum === currentPage ? 'page' : undefined}
              >
                {pageNum}
              </Button>
            )
          ))}
        </div>

        {/* Next page button */}
        <Button
          variant="secondary"
          size="small"
          disabled={currentPage === totalPages || isLoading}
          onClick={() => handlePageClick(currentPage + 1)}
          ariaLabel="Next page"
        >
          <span aria-hidden="true">&raquo;</span>
          <span className="sr-only">Next</span>
        </Button>
      </div>

      {/* Page size selector */}
      {onPageSizeChange && (
        <div className="pagination__size-selector">
          <label htmlFor="pageSize" className="sr-only">
            Items per page
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={handlePageSizeChange}
            disabled={isLoading}
            className="pagination__select"
            aria-label="Items per page"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </div>
      )}
    </nav>
  );
});

Pagination.displayName = 'Pagination';

export type { PaginationProps };