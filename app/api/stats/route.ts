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
    const result = await pool.query<{
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
    }>(`
      SELECT
        sa.platform,
        sa.name,
        sa.url,
        latest.followers,
        latest.total_likes,
        latest.posts_count,
        CASE
          WHEN latest.followers IS NOT NULL
           AND prev.followers IS NOT NULL
           AND (latest.recorded_date - prev.recorded_date) = 1
          THEN latest.followers - prev.followers
        END AS daily_growth,
        CASE
          WHEN latest.followers IS NOT NULL
           AND wk.followers IS NOT NULL
          THEN latest.followers - wk.followers
        END AS weekly_growth,
        CASE
          WHEN latest.followers IS NOT NULL
           AND mo.followers IS NOT NULL
          THEN latest.followers - mo.followers
        END AS monthly_growth,
        TO_CHAR(latest.recorded_date, 'YYYY-MM-DD') AS last_updated,
        TO_CHAR(latest.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS scraped_at
      FROM social_accounts sa
      LEFT JOIN LATERAL (
        SELECT followers, total_likes, posts_count, recorded_date, created_at
        FROM follower_history
        WHERE account_id = sa.id
        ORDER BY recorded_date DESC, created_at DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT followers, recorded_date
        FROM follower_history
        WHERE account_id = sa.id
          AND latest.recorded_date IS NOT NULL
          AND recorded_date < latest.recorded_date
        ORDER BY recorded_date DESC
        LIMIT 1
      ) prev ON true
      LEFT JOIN LATERAL (
        SELECT followers
        FROM follower_history
        WHERE account_id = sa.id
          AND latest.recorded_date IS NOT NULL
          AND recorded_date BETWEEN latest.recorded_date - 10
                                AND latest.recorded_date - 7
        ORDER BY recorded_date DESC
        LIMIT 1
      ) wk ON true
      LEFT JOIN LATERAL (
        SELECT followers
        FROM follower_history
        WHERE account_id = sa.id
          AND latest.recorded_date IS NOT NULL
          AND recorded_date BETWEEN latest.recorded_date - 35
                                AND latest.recorded_date - 30
        ORDER BY recorded_date DESC
        LIMIT 1
      ) mo ON true
      ORDER BY sa.id
    `);

    const stats: StatsResponse = {};
    for (const row of result.rows) {
      stats[row.platform] = {
        platform: row.platform,
        name: row.name,
        url: row.url,
        followers: row.followers,
        total_likes: row.total_likes ?? null,
        posts_count: row.posts_count ?? null,
        daily_growth: row.daily_growth ?? null,
        weekly_growth: row.weekly_growth ?? null,
        monthly_growth: row.monthly_growth ?? null,
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
