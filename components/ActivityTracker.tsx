"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { pingSession, trackPageView, endSession } from "@/app/actions/tracking";

// Invisible component mounted in the (app) layout. Tracks two things:
//   1. Session heartbeat — keeps the user_sessions row alive with a 60-second ping.
//   2. Page views — records a user_activities row on each pathname change.
// Renders nothing; all side-effects happen in useEffect hooks.
export default function ActivityTracker() {
  const pathname = usePathname();
  // useRef instead of state so updating it never triggers a re-render.
  const trackedPath = useRef<string | null>(null);

  useEffect(() => {
    // Ping immediately on mount (covers the first page load).
    pingSession();

    const interval = setInterval(() => {
      pingSession();
    }, 60000); // 60 s — keep the active session row fresh

    // We use "pagehide" instead of "beforeunload" because:
    //   - beforeunload is unreliable in iOS Safari and suppressed in PWA mode.
    //   - pagehide fires consistently when the page is hidden/closed, including
    //     when a PWA is swiped away on mobile.
    const handlePageHide = () => {
      endSession();
    };
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  useEffect(() => {
    // Guard against double-tracking the same pathname (e.g. React Strict Mode
    // double-invocation or rapid navigation that settles back to the same route).
    if (pathname && pathname !== trackedPath.current) {
      trackedPath.current = pathname;
      trackPageView(pathname);
    }
  }, [pathname]);

  return null;
}
