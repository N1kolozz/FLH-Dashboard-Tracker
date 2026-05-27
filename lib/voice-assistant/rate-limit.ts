// Sliding-window per-user rate limit for voice assistant tool calls.
//
// 30 calls / 5 minutes per user. State lives in-memory in the Node process —
// resets on deploy. Acceptable because the limit is for runaway prevention
// (e.g. the AI loops on itself), not security. Per-call auth is the security
// boundary.

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CALLS = 30;

// userId → timestamps of recent calls (ms since epoch).
const timestamps = new Map<number, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  recentCount: number;
}

export function checkVoiceRateLimit(userId: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const existing = timestamps.get(userId) ?? [];
  // Drop entries outside the window.
  const recent = existing.filter((t) => t > cutoff);

  if (recent.length >= MAX_CALLS) {
    // The oldest in-window call defines when one slot frees up.
    const retryAfterMs = recent[0] + WINDOW_MS - now;
    timestamps.set(userId, recent);
    return { allowed: false, retryAfterMs, recentCount: recent.length };
  }

  recent.push(now);
  timestamps.set(userId, recent);
  return { allowed: true, recentCount: recent.length };
}
