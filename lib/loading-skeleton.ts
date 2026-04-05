export function getStoredSkeletonCount(key: string, fallback = 0) {
  if (typeof window === "undefined") return fallback;

  const raw = window.localStorage.getItem(key);
  const count = Number(raw);

  if (!Number.isFinite(count) || count < 0) {
    return fallback;
  }

  return Math.floor(count);
}

export function setStoredSkeletonCount(key: string, count: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(Math.max(0, Math.floor(count))));
}

export function getStoredSkeletonMap<T extends Record<string, number>>(
  key: string,
  fallback: T
) {
  if (typeof window === "undefined") return fallback;

  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next = { ...fallback };

    for (const [entryKey, entryValue] of Object.entries(fallback)) {
      const candidate = Number(parsed[entryKey]);
      next[entryKey as keyof T] = (
        Number.isFinite(candidate) && candidate >= 0
          ? Math.floor(candidate)
          : entryValue
      ) as T[keyof T];
    }

    return next;
  } catch {
    return fallback;
  }
}

export function setStoredSkeletonMap(
  key: string,
  value: Record<string, number>
) {
  if (typeof window === "undefined") return;

  const normalized = Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      Math.max(0, Math.floor(entryValue)),
    ])
  );

  window.localStorage.setItem(key, JSON.stringify(normalized));
}

export function resolveSkeletonCount(
  currentCount: number,
  cachedCount: number,
  fallback = 1
) {
  if (currentCount > 0) return currentCount;
  if (cachedCount > 0) return cachedCount;
  return fallback;
}
