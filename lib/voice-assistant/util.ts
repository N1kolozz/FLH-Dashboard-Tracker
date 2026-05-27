// Shared helpers for the voice assistant tools.
// Kept framework-free so both server actions and client config can import.

import type { Session } from "@/lib/auth";

// ── Role tiers ───────────────────────────────────────────────────────────────
// Only two effective access levels: anyone logged in, or HEAD/ADMIN.
// The Management-dept tier exists in the dashboard nav (for the workload &
// attendance summary pages) but is collapsed here — we gate those tools at
// HEAD/ADMIN by user preference.

export type RoleLevel = "any" | "headOrAdmin";

export function isHeadOrAdminSession(session: Session): boolean {
  const role = session.role?.toUpperCase();
  return role === "ADMIN" || role === "HEAD";
}

// ── Sanitizers ───────────────────────────────────────────────────────────────
// `users` rows contain server-only fields that must never reach the model.
// Phone and email are *not* on the denylist — they're directory data.

const SENSITIVE_USER_FIELDS = new Set([
  "password_hash",
  "passwordHash",
  "reset_token",
  "resetToken",
]);

export function sanitizeUser<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!SENSITIVE_USER_FIELDS.has(k)) out[k] = v;
  }
  return out as Partial<T>;
}

// Argument logging redactor. Free-text args (search queries, names) could
// contain PII the user spoke. We log argument *names* and *lengths* only,
// keeping values for whitelisted scalar enums.
const SAFE_LOG_KEYS = new Set([
  "daysAhead",
  "months",
  "n",
  "department",
]);

export function sanitizeArgsForLogging(
  args: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!args) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (SAFE_LOG_KEYS.has(k) && (typeof v === "number" || typeof v === "string")) {
      out[k] = v;
    } else if (typeof v === "string") {
      out[k] = `<str:${v.length}>`;
    } else if (v === null || v === undefined) {
      out[k] = null;
    } else {
      out[k] = `<${typeof v}>`;
    }
  }
  return out;
}

// ── Text helpers ─────────────────────────────────────────────────────────────

// Codepoint-safe truncation. `string.slice` cuts mid-surrogate-pair on
// Georgian-language text, producing garbage characters in the AI's transcript.
// Array.from over a string splits on full codepoints.
export function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return chars.slice(0, max).join("") + "…";
}

// Minimum query length for fuzzy searches — guards against enumeration via
// 1-character queries.
export const MIN_SEARCH_LEN = 3;

export function isUsableQuery(q: unknown): q is string {
  return typeof q === "string" && q.trim().length >= MIN_SEARCH_LEN;
}
