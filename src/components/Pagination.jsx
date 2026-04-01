import React from 'react';

export default function Pagination({ page, totalPages, setPage, totalItems, pageSize }) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  // Build page numbers: always include 1, last, and ±1 around current
  const pageNums = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pageNums.push(i);
    }
  }

  const withEllipsis = [];
  for (let i = 0; i < pageNums.length; i++) {
    if (i > 0 && pageNums[i] - pageNums[i - 1] > 1) {
      withEllipsis.push("...");
    }
    withEllipsis.push(pageNums[i]);
  }

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Showing {start}–{end} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          className="rounded px-2.5 py-1 text-xs text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
        >
          ← Prev
        </button>
        {withEllipsis.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-1 text-xs text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`rounded px-2.5 py-1 text-xs border ${
                p === page
                  ? "bg-primary-600 text-white border-primary-600"
                  : "text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => setPage(page + 1)}
          disabled={page === totalPages}
          className="rounded px-2.5 py-1 text-xs text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
