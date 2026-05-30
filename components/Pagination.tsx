"use client";

// Shared pagination control for server-paginated list views (inventory, impact,
// attendance, projects archive). Page numbers are 1-based.
export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  loading = false,
  className = "",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);

  if (total <= pageSize) return null;

  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <div
      className={`flex items-center justify-between gap-3 text-sm text-slate-500 ${className}`}
    >
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(current - 1)}
          disabled={current <= 1 || loading}
          className="rounded-lg px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="px-2 text-xs font-medium text-slate-600">
          Page {current} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(current + 1)}
          disabled={current >= totalPages || loading}
          className="rounded-lg px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
