import { useState, useEffect, useCallback } from 'react';

interface UseAdaptivePaginationProps {
  /** Fixed height of each data row/item in pixels */
  rowHeight: number;
  /** Minimum number of items per page */
  minPageSize?: number;
  /** Height of the navbar (defaults to 60) */
  navbarHeight?: number;
  /** Fixed padding/margins to subtract */
  basePadding?: number;
  /** Function to calculate total height of other dynamic elements (headers, filters, etc.) */
  getOtherElementsHeight: () => number;
  /** Dependencies that should trigger recalculation */
  dependencies?: any[];
}

/**
 * A hook to calculate the optimal page size based on available screen height.
 * Matches the behavior of TelegramNewsPage.
 */
export const useAdaptivePagination = ({
  rowHeight,
  minPageSize = 5,
  navbarHeight = 60,
  basePadding = 40, // Default padding/margins
  getOtherElementsHeight,
  dependencies = []
}: UseAdaptivePaginationProps) => {
  const [pageSize, setPageSize] = useState<number>(minPageSize);

  const calculatePageSize = useCallback(() => {
    // Calculate total occupied height by headers, filters, pagination, etc.
    const otherHeight = getOtherElementsHeight();
    
    // Available height for the list/table
    const availableHeight = window.innerHeight - navbarHeight - otherHeight - basePadding;
    
    // Calculate number of items that fit
    // Use Math.floor to ensure they fit fully
    const calculatedSize = Math.floor(availableHeight / rowHeight);
    
    // Ensure minimum size
    const newSize = Math.max(minPageSize, calculatedSize);
    
    setPageSize(prev => {
      if (prev !== newSize) {
        // console.log(`Adaptive Pagination: Resizing from ${prev} to ${newSize} (Available: ${availableHeight}px, Row: ${rowHeight}px)`);
        return newSize;
      }
      return prev;
    });
  }, [rowHeight, minPageSize, navbarHeight, basePadding, getOtherElementsHeight]);

  useEffect(() => {
    // Initial calculation
    calculatePageSize();
    
    // Debounce resize event
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(calculatePageSize, 100);
    };

    window.addEventListener('resize', handleResize);
    
    // Also set a timeout to calculate after initial render/layout
    const initialTimer = setTimeout(calculatePageSize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
      clearTimeout(initialTimer);
    };
  }, [calculatePageSize, ...dependencies]);

  return { pageSize, calculatePageSize };
};
