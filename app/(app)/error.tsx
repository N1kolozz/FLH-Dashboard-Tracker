"use client";

// Error boundary scoped to all protected (app) routes. Sidebar and other
// layout chrome stay rendered — only the page content shows the fallback.

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary:", error.message, error.digest);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="max-w-md w-full">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          This page failed to load
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          We hit an unexpected error. You can retry or return to the dashboard.
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
          >
            Retry
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
          >
            Dashboard
          </a>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-slate-400">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
