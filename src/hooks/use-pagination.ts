import { useState, useMemo, useCallback } from 'react';

export function usePagination<T>(items: T[], pageSize = 50) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const goToPage = useCallback((p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => goToPage(safePage + 1), [goToPage, safePage]);
  const prevPage = useCallback(() => goToPage(safePage - 1), [goToPage, safePage]);

  return {
    page: safePage,
    totalPages,
    pageSize,
    pageItems,
    goToPage,
    nextPage,
    prevPage,
    total: items.length,
    startItem: (safePage - 1) * pageSize + 1,
    endItem: Math.min(safePage * pageSize, items.length),
  };
}
