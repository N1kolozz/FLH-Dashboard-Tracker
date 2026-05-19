export function PortfolioBadge({
  label,
  className,
  title,
}: {
  label: string;
  className: string;
  title?: string;
}) {
  return (
    <span
      title={title ?? label}
      className={`inline-flex min-h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-4 sm:px-3 ${className}`}
    >
      {label}
    </span>
  );
}

export function SummaryCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
      <p className={`text-2xl font-bold leading-tight sm:text-3xl ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
        {label}
      </p>
      <p className="mt-1 hidden text-sm text-slate-500 sm:mt-2 sm:block">{hint}</p>
    </div>
  );
}

export function OverviewStatSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
      <div className="h-7 w-16 rounded-full bg-slate-200 sm:h-8 sm:w-20" />
      <div className="mt-2 h-3 w-20 rounded-full bg-slate-100 sm:mt-3 sm:w-28" />
      <div className="mt-2 hidden h-3 w-36 rounded-full bg-slate-100 sm:mt-3 sm:block" />
    </div>
  );
}

export function OverviewPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 h-4 w-36 animate-pulse rounded-full bg-slate-200" />
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="animate-pulse border-b border-slate-100 pb-4 last:border-b-0 last:pb-0"
          >
            <div className="h-4 w-40 rounded-full bg-slate-200" />
            <div className="mt-2 h-3 w-56 rounded-full bg-slate-100" />
            <div className="mt-3 flex gap-2">
              <div className="h-6 w-24 rounded-full bg-slate-100" />
              <div className="h-6 w-20 rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewTableSkeleton() {
  return (
    <div className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Owners</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Deadline</th>
            <th className="px-4 py-3">Last Update</th>
            <th className="px-4 py-3">Outcomes</th>
            <th className="px-4 py-3">Attention</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, idx) => (
            <tr key={idx} className="animate-pulse">
              <td className="px-4 py-4">
                <div className="h-4 w-32 rounded-full bg-slate-200" />
                <div className="mt-2 h-3 w-44 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-4">
                <div className="h-4 w-28 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-4">
                <div className="h-6 w-24 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-4">
                <div className="h-4 w-24 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-4">
                <div className="h-4 w-28 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-4">
                <div className="h-4 w-28 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-4">
                <div className="h-6 w-32 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-4">
                <div className="ml-auto h-8 w-24 rounded-lg bg-slate-100" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
