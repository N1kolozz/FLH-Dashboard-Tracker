"use client";

// Root error boundary. Catches errors that escape every other error boundary
// — including the (app) and (auth) groups. Receives the error and a reset()
// callback from Next.js. Calling reset() re-renders the affected segment.

import { useEffect } from "react";
import { log } from "@/lib/logger";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The error is already logged server-side; this is a safety net for
    // unhandled client errors. Avoid logging PII.
    log.error("Root error boundary", error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-600 mb-6">
              An unexpected error occurred. Try refreshing the page.
            </p>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
            >
              Try again
            </button>
            {error.digest && (
              <p className="mt-4 text-xs text-slate-400">Reference: {error.digest}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
