import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      dateFilter = "AND latest.max_recorded_date IS NOT NULL AND fh.recorded_date >= latest.max_recorded_date - 29";
    } else if (range === "90") {
      dateFilter = "AND latest.max_recorded_date IS NOT NULL AND fh.recorded_date >= latest.max_recorded_date - 89";
    }
    // "all" has no date filter when start/end are not provided

    const result = await pool.query<{
      date: string;
      followers: number;
      total_likes: number | null;
      posts_count: number | null;
    }>(
      `
      WITH account AS (
        SELECT id
        FROM social_accounts
        WHERE platform = $1
        LIMIT 1
      ),
      latest AS (
        SELECT MAX(recorded_date) AS max_recorded_date
        FROM follower_history
        WHERE account_id = (SELECT id FROM account)
      )
      SELECT
        TO_CHAR(fh.recorded_date, 'YYYY-MM-DD') AS date,
        fh.followers,
        fh.total_likes,
        fh.posts_count
      FROM follower_history fh
      JOIN account a ON a.id = fh.account_id
      CROSS JOIN latest
      WHERE 1 = 1
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
