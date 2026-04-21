"use client";

import { useEffect, useState } from "react";
import {
  getPendingAttendancePrompt,
  submitMyAttendance,
} from "@/app/actions/attendance";
import type { AttendancePromptRow } from "@/types";

type ResponseStatus = "present" | "absent" | "excused";

const REASON_PRESETS = [
  "Sick",
  "Travel",
  "Family reason",
  "Volunteering elsewhere",
  "Class or work",
];

const STATUS_OPTIONS: {
  value: ResponseStatus;
  label: string;
  description: string;
  className: string;
}[] = [
  {
    value: "present",
    label: "Present",
    description: "I will attend.",
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  {
    value: "absent",
    label: "Absent",
    description: "I cannot attend.",
    className: "border-rose-300 bg-rose-50 text-rose-800",
  },
  {
    value: "excused",
    label: "Excused",
    description: "I need an excused absence.",
    className: "border-amber-300 bg-amber-50 text-amber-800",
  },
];

function formatDate(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function AttendancePrompt({
  initialPrompt = null,
}: {
  initialPrompt?: AttendancePromptRow | null;
}) {
  const [prompt, setPrompt] = useState<AttendancePromptRow | null>(initialPrompt);
  const [status, setStatus] = useState<ResponseStatus>("present");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkPrompt() {
      const res = await getPendingAttendancePrompt();
      if (cancelled || !("success" in res)) return;
      setPrompt(res.prompt ?? null);
      setStatus("present");
      setReason("");
      setNote("");
      setError("");
    }

    const handleWindowFocus = () => {
      void checkPrompt();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkPrompt();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!prompt) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [prompt]);

  if (!prompt) return null;

  const needsReason = status === "absent" || status === "excused";

  const submit = async () => {
    if (needsReason && !reason.trim()) {
      setError("Please add a reason before submitting.");
      return;
    }

    setSubmitting(true);
    setError("");
    const result = await submitMyAttendance(prompt.session_id, {
      status,
      reason,
      note: needsReason ? "" : note,
    });

    if (result.success) {
      setPrompt(null);
    } else if ("error" in result) {
      setError(
        typeof result.error === "string"
          ? result.error
          : "Failed to submit attendance."
      );
    }

    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-purple-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-purple-200/60 bg-white shadow-2xl shadow-purple-950/30">
        <div className="border-b border-purple-100 bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 px-5 py-5 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700">
            Attendance Required
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            {prompt.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {formatDate(prompt.meeting_date)}
            {prompt.event_time ? ` · ${prompt.event_time}${prompt.event_end_time ? ` - ${prompt.event_end_time}` : ""}` : ""}
            {prompt.event_location ? ` · ${prompt.event_location}` : ""}
          </p>
          {prompt.instructions && (
            <p className="mt-4 rounded-xl border border-purple-100 bg-white/80 px-4 py-3 text-sm text-slate-700">
              {prompt.instructions}
            </p>
          )}
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto bg-purple-50/30 px-5 py-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {STATUS_OPTIONS.map((option) => {
              const active = status === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    setStatus(option.value);
                    if (option.value === "present") {
                      setReason("");
                    }
                    setError("");
                  }}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    active
                      ? option.className
                      : "border-purple-100 bg-white text-slate-600 hover:bg-purple-50"
                  }`}
                >
                  <span className="block text-sm font-bold">{option.label}</span>
                  <span className="mt-1 block text-xs opacity-75">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>

          {needsReason && (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Reason *
              </label>
              <textarea
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setError("");
                }}
                rows={3}
                placeholder="Tell us why you cannot attend."
                className="w-full resize-none rounded-lg border border-purple-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setReason(preset)}
                    className="rounded-lg border border-purple-100 bg-white px-2.5 py-1 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-50"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!needsReason && (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Notes
              </label>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note, for example late or arriving after class"
                className="w-full rounded-lg border border-purple-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting || (needsReason && !reason.trim())}
            className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-700 disabled:bg-slate-300"
          >
            {submitting ? "Submitting..." : "Submit Attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}
