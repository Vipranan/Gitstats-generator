import { useState, useMemo, useEffect } from "react";

export function usePagination(data, pageSize = 10) {
  const [page, setPage] = useState(1);

  // Reset to page 1 when data changes (e.g., repo switch)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setPage(1);
  }, [data]);

  const totalPages = data ? Math.max(1, Math.ceil(data.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);

  const paginatedData = useMemo(() => {
    if (!data) return [];
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  return { page: safePage, setPage, totalPages, paginatedData };
}
