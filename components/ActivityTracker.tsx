"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { pingSession, trackPageView, endSession } from "@/app/actions/tracking";

export default function ActivityTracker() {
  const pathname = usePathname();
  const trackedPath = useRef<string | null>(null);

  useEffect(() => {
    pingSession();

    const interval = setInterval(() => {
      pingSession();
    }, 60000);

    // pagehide fires reliably on mobile PWA and iOS Safari; beforeunload does not
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
    if (pathname && pathname !== trackedPath.current) {
      trackedPath.current = pathname;
      trackPageView(pathname);
    }
  }, [pathname]);

  return null;
}
