"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AudioLines } from "lucide-react";

// The overlay imports @google/genai and the AudioContext APIs — keep it
// lazy so it doesn't bloat the initial sidebar bundle.
const VoiceAssistantOverlay = dynamic(
  () => import("./VoiceAssistantOverlay"),
  { ssr: false }
);

interface VoiceAssistantProps {
  collapsed?: boolean;
}

export default function VoiceAssistant({ collapsed = false }: VoiceAssistantProps) {
  // `active` keeps the overlay (and the live session it owns) mounted.
  // `minimized` only hides the modal UI — the session keeps running so the
  // user can navigate the app and keep talking. Only ending fully unmounts.
  const [active, setActive] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // When the sidebar is collapsed the launch button would float outside the
  // narrow rail, so hide it there. Minimized pill rendering is unaffected.
  if (collapsed) {
    return active ? (
      <VoiceAssistantOverlay
        minimized={minimized}
        onMinimize={() => setMinimized(true)}
        onRestore={() => setMinimized(false)}
        onClose={() => {
          setActive(false);
          setMinimized(false);
        }}
      />
    ) : null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setActive(true);
          setMinimized(false);
        }}
        title="ხმოვანი ასისტენტი (Gemini 3 Flash Live)"
        aria-label="Open voice assistant"
        className={`group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-fuchsia-500 to-indigo-500 text-white shadow-[0_4px_14px_-4px_rgba(168,85,247,0.6)] transition-all hover:scale-105 hover:shadow-[0_6px_18px_-4px_rgba(168,85,247,0.8)] active:scale-95 ${
          collapsed ? "" : ""
        } ${
          // On mobile the minimized pill replaces this logo in the header,
          // so hide the launch button there. Desktop keeps it as-is.
          active && minimized ? "max-md:hidden" : ""
        }`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400 via-fuchsia-400 to-indigo-400 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-60"
        />
        <AudioLines className="relative h-4 w-4" strokeWidth={2.2} />
      </button>
      {active && (
        <VoiceAssistantOverlay
          minimized={minimized}
          onMinimize={() => setMinimized(true)}
          onRestore={() => setMinimized(false)}
          onClose={() => {
            setActive(false);
            setMinimized(false);
          }}
        />
      )}
    </>
  );
}
