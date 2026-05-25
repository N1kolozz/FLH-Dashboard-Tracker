// Social media statistics queries, wrapped with Next.js unstable_cache for a
// 5-minute server-side TTL. All queries use LATERAL subqueries so that every
// platform row is resolved in a single round-trip, regardless of how many
// social_accounts rows exist.

import { unstable_cache } from "next/cache";
import { pool } from "@/lib/db";

// How long the cached stats live before Next.js re-runs the underlying query.
// 300 s = 5 minutes. Matches the scrape cadence — there is no point fetching
// more often because the scraper only writes once per day anyway.
export const SOCIAL_CACHE_REVALIDATE_SECONDS = 300;

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

export interface HistoryPoint {
  date: string;
  followers: number;
  total_likes: number | null;
  posts_count: number | null;
}

export type SocialPlatform = "instagram" | "tiktok" | "facebook";
export type SocialHistoryRange = "30" | "90" | "all";

async function querySocialStats(): Promise<StatsResponse> {
  // One query, four LATERAL subqueries per account row:
  //   latest  — the most recent snapshot (today's or last recorded)
  //   prev    — the snapshot immediately before latest (for daily_growth)
  //   wk      — a snapshot ~7 days ago (window: -10 to -7 to tolerate missed scrapes)
  //   mo      — a snapshot ~30 days ago (window: -35 to -30 for the same reason)
  //
  // Growth values are only emitted when both endpoints exist — null means
  // "not enough history yet", not "zero growth".
  //
  // daily_growth has the extra guard: (latest.recorded_date - prev.recorded_date) = 1
  // so it only reports a day-over-day change when the two rows are truly consecutive.
  // If the scraper missed yesterday, we show null rather than a misleading multi-day delta.
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
    -- Most recent snapshot for each account
    LEFT JOIN LATERAL (
      SELECT followers, total_likes, posts_count, recorded_date, created_at
      FROM follower_history
      WHERE account_id = sa.id
      ORDER BY recorded_date DESC, created_at DESC
      LIMIT 1
    ) latest ON true
    -- Previous day's snapshot (for daily delta)
    LEFT JOIN LATERAL (
      SELECT followers, recorded_date
      FROM follower_history
      WHERE account_id = sa.id
        AND latest.recorded_date IS NOT NULL
        AND recorded_date < latest.recorded_date
      ORDER BY recorded_date DESC
      LIMIT 1
    ) prev ON true
    -- Snapshot from ~7 days ago (tolerance window avoids null on missed scrape days)
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
    -- Snapshot from ~30 days ago (same tolerance window)
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

  return stats;
}

// Wrap with unstable_cache so that repeated RSC renders within the same 5-minute
// window return the cached value without hitting the database again.
// The cache key ["social-stats"] is global — all users share one cached result.
const getCachedSocialStats = unstable_cache(querySocialStats, ["social-stats"], {
  revalidate: SOCIAL_CACHE_REVALIDATE_SECONDS,
});

export function getSocialStats() {
  return getCachedSocialStats();
}

async function querySocialHistory(
  platform: SocialPlatform,
  range: SocialHistoryRange,
  start?: string,
  end?: string
): Promise<HistoryPoint[]> {
  let dateFilter = "";
  const queryParams: string[] = [platform];

  // Build the WHERE clause fragment based on the requested range.
  // "30" / "90" are relative to the latest recorded date (not today's date) so
  // the chart still shows data even if the scraper hasn't run today.
  // An explicit start/end window overrides the range (used by the history API).
  if (start && end) {
    dateFilter = "AND fh.recorded_date BETWEEN $2::date AND $3::date";
    queryParams.push(start, end);
  } else if (range === "30") {
    dateFilter =
      "AND latest.max_recorded_date IS NOT NULL AND fh.recorded_date >= latest.max_recorded_date - 29";
  } else if (range === "90") {
    dateFilter =
      "AND latest.max_recorded_date IS NOT NULL AND fh.recorded_date >= latest.max_recorded_date - 89";
  }
  // range === "all" → no dateFilter, returns every row for that platform

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

  return result.rows.map((row) => ({
    date: row.date,
    followers: Number(row.followers),
    total_likes: row.total_likes === null ? null : Number(row.total_likes),
    posts_count: row.posts_count === null ? null : Number(row.posts_count),
  }));
}

const getCachedSocialHistory = unstable_cache(
  async (
    platform: SocialPlatform,
    range: SocialHistoryRange,
    start?: string,
    end?: string
  ) => querySocialHistory(platform, range, start, end),
  ["social-history"],
  { revalidate: SOCIAL_CACHE_REVALIDATE_SECONDS }
);

export function getSocialHistory(options: {
  platform: SocialPlatform;
  range?: SocialHistoryRange;
  start?: string;
  end?: string;
}) {
  return getCachedSocialHistory(
    options.platform,
    options.range ?? "30",
    options.start,
    options.end
  );
}
