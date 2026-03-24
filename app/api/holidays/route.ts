import { NextResponse } from "next/server";

/** ISO 3166-1 alpha-2 — Georgia */
const COUNTRY = "GE";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("year");
  const y = raw ? parseInt(raw, 10) : new Date().getFullYear();
  if (!Number.isFinite(y) || y < 1970 || y > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`https://date.nager.at/api/v3/publicholidays/${y}/${COUNTRY}`, {
      next: { revalidate: 86400 },
    });
    if (!upstream.ok) {
      console.warn("Holidays API upstream non-OK", {
        status: upstream.status,
        year: y,
        country: COUNTRY,
      });
      return NextResponse.json([]);
    }
    const rawList: unknown = await upstream.json();
    if (!Array.isArray(rawList)) {
      console.warn("Holidays API upstream returned non-array payload", {
        year: y,
        country: COUNTRY,
      });
      return NextResponse.json([]);
    }
    type Row = { date: string; name: string; localName: string };
    const out: Row[] = [];
    for (const item of rawList) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const date = typeof o.date === "string" ? o.date : "";
      const name = typeof o.name === "string" ? o.name : "";
      const localName = typeof o.localName === "string" ? o.localName : name;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      out.push({ date, name, localName: localName || name });
    }
    return NextResponse.json(out);
  } catch (error) {
    console.error("Holidays API fetch failed", {
      year: y,
      country: COUNTRY,
      error: String(error),
    });
    return NextResponse.json([]);
  }
}
