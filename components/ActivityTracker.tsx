"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { pingSession, trackPageView, endSession } from "@/app/actions/tracking";

export default function ActivityTracker() {
  const pathname = usePathname();
  const trackedPath = useRef<string | null>(null);

  useEffect(() => {
    // Ping immediately when mounted
    pingSession();

    // Ping every 60 seconds
    const interval = setInterval(() => {
      pingSession();
    }, 60000);

    // End session on unmount or beforeunload
    const handleBeforeUnload = () => {
      endSession();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (pathname && pathname !== trackedPath.current) {
      trackedPath.current = pathname;
      trackPageView(pathname);
    }
  }, [pathname]);

  return null;
}
