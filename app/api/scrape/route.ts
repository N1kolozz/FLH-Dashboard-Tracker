import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { scrapeAll } from "@/scripts/scrapeFollowers";

export const maxDuration = 300; // 5 minutes for scraping

export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Starting scrape job via API...");
    const results = await scrapeAll();

    const saved: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const result of results) {
      if (result.error) {
        errors.push(`${result.platform}: ${result.error}`);
        continue;
      }
      if (result.followers === null) {
        skipped.push(result.platform);
        continue;
      }

      const accountRes = await pool.query(
        "SELECT id FROM social_accounts WHERE platform = $1",
        [result.platform]
      );

      if (accountRes.rows.length === 0) {
        errors.push(`${result.platform}: account not found in DB`);
        continue;
      }

      const accountId = accountRes.rows[0].id;
      await pool.query(
        `INSERT INTO follower_history (account_id, followers, total_likes, posts_count, recorded_date)
         VALUES ($1, $2, $3, $4, CURRENT_DATE)
         ON CONFLICT (account_id, recorded_date)
         DO UPDATE SET
           followers = EXCLUDED.followers,
           total_likes = COALESCE(EXCLUDED.total_likes, follower_history.total_likes),
           posts_count = COALESCE(EXCLUDED.posts_count, follower_history.posts_count),
           created_at = CURRENT_TIMESTAMP`,
        [accountId, result.followers, result.total_likes ?? null, result.posts_count ?? null]
      );

      saved.push(
        `${result.platform}: ${result.followers} followers${result.total_likes != null ? `, ${result.total_likes} likes` : ""}${result.posts_count != null ? `, ${result.posts_count} posts` : ""}`
      );
    }

    return NextResponse.json({
      success: true,
      saved,
      skipped,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Scrape API error:", err);
    return NextResponse.json(
      { error: "Scrape job failed", details: String(err) },
      { status: 500 }
    );
  }
}
