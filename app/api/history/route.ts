import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export interface HistoryPoint {
  date: string;
  followers: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const platform = searchParams.get("platform");
  const range = searchParams.get("range") ?? "30"; // "30", "90", or "all"

  if (!platform) {
    return NextResponse.json(
      { error: "Missing required query param: platform" },
      { status: 400 }
    );
  }

  const validPlatforms = ["instagram", "tiktok", "facebook"];
  if (!validPlatforms.includes(platform)) {
    return NextResponse.json(
      { error: `Invalid platform. Must be one of: ${validPlatforms.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    let dateFilter = "";
    if (range === "30") {
      dateFilter = "AND fh.recorded_date >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (range === "90") {
      dateFilter = "AND fh.recorded_date >= CURRENT_DATE - INTERVAL '90 days'";
    }
    // "all" has no date filter

    const result = await pool.query<{ date: string; followers: number }>(
      `
      SELECT
        TO_CHAR(fh.recorded_date, 'YYYY-MM-DD') AS date,
        fh.followers
      FROM follower_history fh
      JOIN social_accounts sa ON sa.id = fh.account_id
      WHERE sa.platform = $1
        ${dateFilter}
      ORDER BY fh.recorded_date ASC
      `,
      [platform]
    );

    const history: HistoryPoint[] = result.rows.map((row) => ({
      date: row.date,
      followers: Number(row.followers),
    }));

    return NextResponse.json(history);
  } catch (err) {
    console.error("History API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch history", details: String(err) },
      { status: 500 }
    );
  }
}
