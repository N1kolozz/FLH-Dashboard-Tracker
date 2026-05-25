"use client";

import { useEffect } from "react";
import { log } from "@/lib/logger";

export default function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      log.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
