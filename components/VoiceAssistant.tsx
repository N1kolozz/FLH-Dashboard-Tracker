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
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="ხმოვანი ასისტენტი (Gemini 3 Flash Live)"
        aria-label="Open voice assistant"
        className={`group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-fuchsia-500 to-indigo-500 text-white shadow-[0_4px_14px_-4px_rgba(168,85,247,0.6)] transition-all hover:scale-105 hover:shadow-[0_6px_18px_-4px_rgba(168,85,247,0.8)] active:scale-95 ${
          collapsed ? "" : ""
        }`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400 via-fuchsia-400 to-indigo-400 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-60"
        />
        <AudioLines className="relative h-4 w-4" strokeWidth={2.2} />
      </button>
      {open && <VoiceAssistantOverlay onClose={() => setOpen(false)} />}
    </>
  );
}
