import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export interface PlatformStats {
  platform: string;
  name: string;
  url: string;
  followers: number | null;
  daily_growth: number | null;
  weekly_growth: number | null;
  monthly_growth: number | null;
  last_updated: string | null;
}

export interface StatsResponse {
  [platform: string]: PlatformStats;
}

export async function GET() {
  try {
    const result = await pool.query<{
      platform: string;
      name: string;
      url: string;
      followers: number | null;
      followers_yesterday: number | null;
      followers_7d: number | null;
      followers_30d: number | null;
      last_updated: string | null;
    }>(`
      SELECT
        sa.platform,
        sa.name,
        sa.url,
        latest.followers,
        yesterday.followers AS followers_yesterday,
        week_ago.followers AS followers_7d,
        month_ago.followers AS followers_30d,
        TO_CHAR(latest.recorded_date, 'YYYY-MM-DD') AS last_updated
      FROM social_accounts sa
      LEFT JOIN LATERAL (
        SELECT followers, recorded_date
        FROM follower_history
        WHERE account_id = sa.id
        ORDER BY recorded_date DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT followers
        FROM follower_history
        WHERE account_id = sa.id
          AND recorded_date = CURRENT_DATE - INTERVAL '1 day'
        LIMIT 1
      ) yesterday ON true
      LEFT JOIN LATERAL (
        SELECT followers
        FROM follower_history
        WHERE account_id = sa.id
          AND recorded_date <= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY recorded_date DESC
        LIMIT 1
      ) week_ago ON true
      LEFT JOIN LATERAL (
        SELECT followers
        FROM follower_history
        WHERE account_id = sa.id
          AND recorded_date <= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY recorded_date DESC
        LIMIT 1
      ) month_ago ON true
      ORDER BY sa.id
    `);

    const stats: StatsResponse = {};
    for (const row of result.rows) {
      const current = row.followers;
      stats[row.platform] = {
        platform: row.platform,
        name: row.name,
        url: row.url,
        followers: current,
        daily_growth:
          current !== null && row.followers_yesterday !== null
            ? current - row.followers_yesterday
            : null,
        weekly_growth:
          current !== null && row.followers_7d !== null
            ? current - row.followers_7d
            : null,
        monthly_growth:
          current !== null && row.followers_30d !== null
            ? current - row.followers_30d
            : null,
        last_updated: row.last_updated,
      };
    }

    return NextResponse.json(stats);
  } catch (err) {
    console.error("Stats API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch stats", details: String(err) },
      { status: 500 }
    );
  }
}
