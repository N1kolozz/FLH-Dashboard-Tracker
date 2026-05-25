"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Calls router.refresh() on a fixed interval to re-fetch RSC data without a
// full navigation. Used on live dashboards and the attendance page so data
// stays current while the tab is open.
//
// Visibility-aware: the timer is paused when the tab/app is hidden and
// immediately fires a refresh when it becomes visible again. This prevents
// wasted network requests when the PWA is backgrounded on mobile.
export default function AutoRefresh({ interval = 30000 }: { interval?: number }) {
  const router = useRouter();
  // Store the interval ID in a ref so start/stop helpers share it without
  // causing re-renders on every tick.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = () => {
      if (timerRef.current) return; // Already running — don't stack timers.
      timerRef.current = setInterval(() => router.refresh(), interval);
    };

    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        // Refresh immediately on tab focus so the user sees fresh data right
        // away, then restart the timer for subsequent background refreshes.
        router.refresh();
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router, interval]);

  return null;
}
