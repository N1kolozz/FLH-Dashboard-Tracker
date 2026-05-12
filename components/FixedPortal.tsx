"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children directly on document.body via a React portal.
 * Use this to wrap any `position: fixed` overlay (drawers, modals, toasts)
 * that lives inside a component with a CSS transform — transforms create a new
 * containing block and break fixed positioning relative to the viewport.
 */
export default function FixedPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(<>{children}</>, document.body);
}
