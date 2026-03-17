import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface PlatformStats {
  platform: string;
  name: string;
  url: string;
  followers: number | null;
  total_likes: number | null;
  posts_count: number | null;
  daily_growth: number | null;
  weekly_growth: number | null;
  monthly_growth: number | null;
  last_updated: string | null;
  scraped_at: string | null;
}

export interface StatsResponse {
  [platform: string]: PlatformStats;
}

export async function GET() {
  try {
    const appTimeZone = process.env.APP_TIMEZONE || "UTC";
    const result = await pool.query<{
      platform: string;
      name: string;
      url: string;
      followers: number | null;
      total_likes: number | null;
      posts_count: number | null;
      followers_yesterday: number | null;
      followers_7d: number | null;
      followers_30d: number | null;
      last_updated: string | null;
      scraped_at: string | null;
    }>(`
      WITH tz AS (
        SELECT timezone($1, now())::date AS today
      )
      SELECT
        sa.platform,
        sa.name,
        sa.url,
        latest.followers,
        latest.total_likes,
        latest.posts_count,
        yesterday.followers AS followers_yesterday,
        week_ago.followers AS followers_7d,
        month_ago.followers AS followers_30d,
        TO_CHAR(latest.recorded_date, 'YYYY-MM-DD') AS last_updated,
        TO_CHAR(latest.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS scraped_at
      FROM social_accounts sa
      CROSS JOIN tz
      LEFT JOIN LATERAL (
        SELECT followers, total_likes, posts_count, recorded_date, created_at
        FROM follower_history
        WHERE account_id = sa.id
        ORDER BY recorded_date DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT followers
        FROM follower_history
        WHERE account_id = sa.id
          AND recorded_date = tz.today - 1
        LIMIT 1
      ) yesterday ON true
      LEFT JOIN LATERAL (
        SELECT followers
        FROM follower_history
        WHERE account_id = sa.id
          AND recorded_date <= tz.today - 7
        ORDER BY recorded_date DESC
        LIMIT 1
      ) week_ago ON true
      LEFT JOIN LATERAL (
        SELECT followers
        FROM follower_history
        WHERE account_id = sa.id
          AND recorded_date <= tz.today - 30
        ORDER BY recorded_date DESC
        LIMIT 1
      ) month_ago ON true
      ORDER BY sa.id
    `, [appTimeZone]);

    const stats: StatsResponse = {};
    for (const row of result.rows) {
      const current = row.followers;
      stats[row.platform] = {
        platform: row.platform,
        name: row.name,
        url: row.url,
        followers: current,
        total_likes: row.total_likes ?? null,
        posts_count: row.posts_count ?? null,
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
        scraped_at: row.scraped_at,
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
