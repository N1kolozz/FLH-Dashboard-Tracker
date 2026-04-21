export function ImpactSummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-xl border border-slate-100 bg-white p-5 text-center shadow-sm"
        >
          <div className="mx-auto h-8 w-24 rounded-2xl bg-slate-200" />
          <div className="mx-auto mt-2 h-3 w-24 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function ImpactChartSkeleton({ count }: { count: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 h-4 w-40 animate-pulse rounded-full bg-slate-200" />
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="animate-pulse">
            <div className="mb-1 flex items-center justify-between">
              <div className="h-4 w-28 rounded-full bg-slate-100" />
              <div className="h-4 w-20 rounded-full bg-slate-100" />
            </div>
            <div className="h-2.5 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ImpactTableSkeleton({ count }: { count: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Activity</th>
            <th className="px-4 py-3">Result</th>
            <th className="px-4 py-3">Evidence</th>
            <th className="px-4 py-3 text-right">People Reached</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: count }).map((_, idx) => (
            <tr key={idx} className="animate-pulse">
              <td className="px-4 py-3">
                <div className="h-4 w-20 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-36 rounded-full bg-slate-200" />
              </td>
              <td className="px-4 py-3">
                <div className="h-5 w-20 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-40 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-20 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="ml-auto h-4 w-16 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-3">
                <div className="h-6 w-12 rounded-md bg-slate-100" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
