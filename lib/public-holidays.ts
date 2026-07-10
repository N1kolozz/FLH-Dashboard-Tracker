export type PublicHoliday = { date: string; name: string; localName: string };
export type FetchPublicHolidaysResult = { holidays: PublicHoliday[]; ok: boolean };

/** Tailwind classes for holiday chips in calendar cells */
export const holidayChipClass =
  "text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate font-medium bg-amber-50 text-amber-800 border border-amber-200";

export function buildHolidaysByDate(holidays: PublicHoliday[]): Map<string, PublicHoliday[]> {
  const m = new Map<string, PublicHoliday[]>();
  for (const h of holidays) {
    const list = m.get(h.date) ?? [];
    list.push(h);
    m.set(h.date, list);
  }
  m.forEach((list) => {
    list.sort((a, b) => a.localName.localeCompare(b.localName));
  });
  return m;
}

export async function fetchPublicHolidaysWithStatus(
  year: number
): Promise<FetchPublicHolidaysResult> {
  try {
    const safeYear = Number.isFinite(year) ? Math.trunc(year) : new Date().getFullYear();
    const res = await fetch(`/api/holidays?year=${safeYear}`);
    if (!res.ok) return { holidays: [], ok: false };
    const data: unknown = await res.json();
    return Array.isArray(data)
      ? { holidays: data as PublicHoliday[], ok: true }
      : { holidays: [], ok: false };
  } catch {
    return { holidays: [], ok: false };
  }
}

export function holidayLabel(h: PublicHoliday): string {
  return h.localName?.trim() || h.name;
}
