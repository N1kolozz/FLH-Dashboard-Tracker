"use client";

// Error boundary for /login and /create-password. Keeps the user on the auth
// flow rather than bouncing them through the root error boundary.

import { useEffect } from "react";
import { log } from "@/lib/logger";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error("Auth error boundary", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm w-full bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">
          Authentication error
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Something went wrong. Try again, or refresh the page.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition w-full"
        >
          Try again
        </button>
        {error.digest && (
          <p className="mt-4 text-xs text-slate-400">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
