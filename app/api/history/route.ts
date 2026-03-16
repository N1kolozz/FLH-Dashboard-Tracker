import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export interface HistoryPoint {
  date: string;
  followers: number;
  total_likes: number | null;
  posts_count: number | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const platform = searchParams.get("platform");
  const range = searchParams.get("range") ?? "30"; // "30", "90", or "all"
  const start = searchParams.get("start");
  const end = searchParams.get("end");

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
    const queryParams: string[] = [platform];
    if (start && end) {
      dateFilter = "AND fh.recorded_date BETWEEN $2::date AND $3::date";
      queryParams.push(start, end);
    } else if (range === "30") {
      dateFilter = "AND fh.recorded_date >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (range === "90") {
      dateFilter = "AND fh.recorded_date >= CURRENT_DATE - INTERVAL '90 days'";
    }
    // "all" has no date filter when start/end are not provided

    const result = await pool.query<{
      date: string;
      followers: number;
      total_likes: number | null;
      posts_count: number | null;
    }>(
      `
      SELECT
        TO_CHAR(fh.recorded_date, 'YYYY-MM-DD') AS date,
        fh.followers,
        fh.total_likes,
        fh.posts_count
      FROM follower_history fh
      JOIN social_accounts sa ON sa.id = fh.account_id
      WHERE sa.platform = $1
        ${dateFilter}
      ORDER BY fh.recorded_date ASC
      `,
      queryParams
    );

    const history: HistoryPoint[] = result.rows.map((row) => ({
      date: row.date,
      followers: Number(row.followers),
      total_likes:
        row.total_likes === null ? null : Number(row.total_likes),
      posts_count:
        row.posts_count === null ? null : Number(row.posts_count),
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
