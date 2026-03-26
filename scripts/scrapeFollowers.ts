import { chromium, Page, BrowserContext } from "playwright";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const GRAPH_API_VERSION = "v19.0";

/** TikTok profile URL (Instagram/Facebook use Meta Graph API). */
const TIKTOK_PROFILE_URL = "https://www.tiktok.com/@future_leaders_hub";

const PLATFORM_ORDER = ["instagram", "tiktok", "facebook"] as const;

interface ProfileScrape {
  followers: number | null;
  totalLikes: number | null;
  postsCount: number | null;
}

interface ScrapeResult {
  platform: string;
  followers: number | null;
  total_likes: number | null;
  posts_count: number | null;
  error?: string;
}

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").replace(/\s/g, "").trim();
  const match = cleaned.match(/^([\d.]+)\s*([KkMmBb]?)$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = match[2].toUpperCase();
  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

function extractFirstNumber(text: string, keyword: string): number | null {
  const patterns = [
    new RegExp(`([\\d,. ]+[KkMmBb]?)\\s*${keyword}`, "i"),
    new RegExp(`${keyword}[:\\s]+([\\d,. ]+[KkMmBb]?)`, "i"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const count = parseNumber(match[1]);
      if (count !== null && count > 0) return count;
    }
  }
  return null;
}

function metaGraphQuery(nodeId: string, fields: string): string {
  const token = process.env.META_ACCESS_TOKEN?.trim() ?? "";
  const params = new URLSearchParams({
    fields,
    access_token: token,
  });
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(nodeId)}?${params}`;
}

function formatMetaError(data: unknown, fallback: string): string {
  const err = data as { error?: { message?: string; type?: string; code?: number } };
  if (err?.error?.message) {
    return err.error.code != null
      ? `${err.error.message} (${err.error.type ?? "error"} ${err.error.code})`
      : err.error.message;
  }
  return fallback;
}

async function fetchInstagramGraphApi(): Promise<ScrapeResult> {
  const token = process.env.META_ACCESS_TOKEN?.trim() ?? "";
  const igId = process.env.IG_ACCOUNT_ID?.trim() ?? "";
  const missing: string[] = [];
  if (!token) missing.push("META_ACCESS_TOKEN");
  if (!igId) missing.push("IG_ACCOUNT_ID");
  if (missing.length > 0) {
    return {
      platform: "instagram",
      followers: null,
      total_likes: null,
      posts_count: null,
      error: `Missing env: ${missing.join(", ")}`,
    };
  }

  try {
    const url = metaGraphQuery(igId, "followers_count,media_count");
    const res = await fetch(url);
    const data = (await res.json().catch(() => null)) as Record<string, unknown>;

    if (!res.ok || (data && "error" in data && data.error)) {
      const msg = formatMetaError(data, `HTTP ${res.status}`);
      console.error(`  instagram error: ${msg}`);
      return {
        platform: "instagram",
        followers: null,
        total_likes: null,
        posts_count: null,
        error: msg,
      };
    }

    const followersRaw = data.followers_count;
    const mediaRaw = data.media_count;
    const followers =
      typeof followersRaw === "number" ? followersRaw : null;
    const postsCount =
      typeof mediaRaw === "number" ? mediaRaw : null;

    if (followers !== null) console.log(`  [IG] followers: ${followers}`);
    if (postsCount !== null) console.log(`  [IG] posts: ${postsCount}`);

    return {
      platform: "instagram",
      followers,
      total_likes: null,
      posts_count: postsCount,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`  instagram error: ${error}`);
    return {
      platform: "instagram",
      followers: null,
      total_likes: null,
      posts_count: null,
      error,
    };
  }
}

async function fetchFacebookGraphApi(): Promise<ScrapeResult> {
  const token = process.env.META_ACCESS_TOKEN?.trim() ?? "";
  const pageId = process.env.FB_PAGE_ID?.trim() ?? "";
  const missing: string[] = [];
  if (!token) missing.push("META_ACCESS_TOKEN");
  if (!pageId) missing.push("FB_PAGE_ID");
  if (missing.length > 0) {
    return {
      platform: "facebook",
      followers: null,
      total_likes: null,
      posts_count: null,
      error: `Missing env: ${missing.join(", ")}`,
    };
  }

  try {
    const url = metaGraphQuery(pageId, "followers_count,fan_count");
    const res = await fetch(url);
    const data = (await res.json().catch(() => null)) as Record<string, unknown>;

    if (!res.ok || (data && "error" in data && data.error)) {
      const msg = formatMetaError(data, `HTTP ${res.status}`);
      console.error(`  facebook error: ${msg}`);
      return {
        platform: "facebook",
        followers: null,
        total_likes: null,
        posts_count: null,
        error: msg,
      };
    }

    const followersRaw = data.followers_count;
    const fanRaw = data.fan_count;
    const followers =
      typeof followersRaw === "number" ? followersRaw : null;
    const totalLikes =
      typeof fanRaw === "number" ? fanRaw : null;

    if (followers !== null) console.log(`  [FB] followers: ${followers}`);
    if (totalLikes !== null) console.log(`  [FB] likes: ${totalLikes}`);

    return {
      platform: "facebook",
      followers,
      total_likes: totalLikes,
      posts_count: null,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`  facebook error: ${error}`);
    return {
      platform: "facebook",
      followers: null,
      total_likes: null,
      posts_count: null,
      error,
    };
  }
}

async function createContext(): Promise<{ context: BrowserContext; close: () => Promise<void> }> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    extraHTTPHeaders: {
      "accept-language": "en-US,en;q=0.9",
    },
  });
  return { context, close: () => browser.close() };
}

const PAGE_OPTS = {
  waitUntil: "domcontentloaded" as const,
  timeout: 18000,
  waitAfter: 500,
};

async function scrapeTikTokWithPage(page: Page, url: string): Promise<ProfileScrape> {
  await page.goto(url, { waitUntil: PAGE_OPTS.waitUntil, timeout: PAGE_OPTS.timeout });
  await page.waitForTimeout(PAGE_OPTS.waitAfter);

  const pageText = await page.evaluate(() => document.body.innerText);
  let followers: number | null = null;
  const followerEl = await page
    .locator('[data-e2e="followers-count"]')
    .first()
    .textContent({ timeout: 5000 })
    .catch(() => null);
  if (followerEl) followers = parseNumber(followerEl);
  if (followers === null) followers = extractFirstNumber(pageText, "Followers");
  if (followers === null) {
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
      const content = await page.locator(selector).first().getAttribute("content").catch(() => null);
      if (content) {
        followers = extractFirstNumber(content, "Followers");
        if (followers !== null) break;
      }
    }
  }
  if (followers === null) {
    const scripts = await page.locator("script").allTextContents();
    for (const script of scripts) {
      const m = script.match(/"followerCount"\s*:\s*(\d+)/);
      if (m && parseInt(m[1], 10) > 0) {
        followers = parseInt(m[1], 10);
        break;
      }
    }
  }
  if (followers !== null) console.log(`  [TT] followers: ${followers}`);

  let totalLikes: number | null = null;
  const likesEl = await page.locator('[data-e2e="likes-count"]').first().textContent({ timeout: 3000 }).catch(() => null);
  if (likesEl) totalLikes = parseNumber(likesEl);
  if (totalLikes === null) totalLikes = extractFirstNumber(pageText, "Likes");
  if (totalLikes !== null) console.log(`  [TT] likes: ${totalLikes}`);

  let postsCount: number | null = extractFirstNumber(pageText, "Videos");
  if (postsCount === null) postsCount = extractFirstNumber(pageText, "videos");
  if (postsCount === null) {
    const scripts = await page.locator("script").allTextContents();
    for (const script of scripts) {
      const m = script.match(/"videoCount"\s*:\s*(\d+)/);
      if (m && parseInt(m[1], 10) >= 0) {
        postsCount = parseInt(m[1], 10);
        break;
      }
    }
  }
  if (postsCount !== null) console.log(`  [TT] videos: ${postsCount}`);

  return { followers: followers ?? null, totalLikes: totalLikes ?? null, postsCount: postsCount ?? null };
}

async function tiktokToResult(page: Page, url: string): Promise<ScrapeResult> {
  try {
    const profile = await scrapeTikTokWithPage(page, url);
    return {
      platform: "tiktok",
      followers: profile.followers ?? null,
      total_likes: profile.totalLikes ?? null,
      posts_count: profile.postsCount ?? null,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`  tiktok error: ${error}`);
    return { platform: "tiktok", followers: null, total_likes: null, posts_count: null, error };
  }
}

export async function scrapeAll(): Promise<ScrapeResult[]> {
  console.log("Fetching Instagram & Facebook via Meta Graph API; scraping TikTok with Playwright...");
  const igPromise = fetchInstagramGraphApi();
  const fbPromise = fetchFacebookGraphApi();

  const { context, close } = await createContext();
  try {
    const pageTt = await context.newPage();
    const [ig, tt, fb] = await Promise.all([
      igPromise,
      tiktokToResult(pageTt, TIKTOK_PROFILE_URL),
      fbPromise,
    ]);

    const byPlatform = new Map<string, ScrapeResult>([
      [ig.platform, ig],
      [tt.platform, tt],
      [fb.platform, fb],
    ]);
    const results = PLATFORM_ORDER.map((p) => byPlatform.get(p)!);

    results.forEach((r) =>
      console.log(
        `  ${r.platform}: followers ${r.followers ?? "N/A"}${r.total_likes != null ? `, likes ${r.total_likes}` : ""}${r.posts_count != null ? `, posts ${r.posts_count}` : ""}${r.error ? ` (${r.error})` : ""}`
      )
    );
    return results;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("Scrape error:", error);
    return PLATFORM_ORDER.map((platform) => ({
      platform,
      followers: null,
      total_likes: null,
      posts_count: null,
      error,
    }));
  } finally {
    await close();
  }
}

async function saveResults(results: ScrapeResult[]): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const appTimeZone = process.env.APP_TIMEZONE || "UTC";

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  const client = await pool.connect();
  try {
    for (const result of results) {
      const accountRes = await client.query(
        "SELECT id FROM social_accounts WHERE platform = $1",
        [result.platform]
      );

      if (accountRes.rows.length === 0) {
        console.warn(`No account found for platform: ${result.platform}`);
        continue;
      }

      const accountId = accountRes.rows[0].id;
      let followersToSave: number | null = result.followers;
      let totalLikesToSave: number | null = result.total_likes ?? null;
      let postsCountToSave: number | null = result.posts_count ?? null;

      // Keep a continuous daily series: if scrape fails for a platform today,
      // carry forward the last known values into today's date.
      if (followersToSave === null) {
        const prevRes = await client.query<{
          followers: number;
          total_likes: number | null;
          posts_count: number | null;
        }>(
          `SELECT followers, total_likes, posts_count
           FROM follower_history
           WHERE account_id = $1
           ORDER BY recorded_date DESC
           LIMIT 1`,
          [accountId]
        );

        if (prevRes.rows.length === 0) {
          console.log(
            `Skipping ${result.platform} — no follower count and no previous data to carry`
          );
          continue;
        }

        const prev = prevRes.rows[0];
        followersToSave = prev.followers;
        totalLikesToSave = prev.total_likes;
        postsCountToSave = prev.posts_count;
        console.log(
          `Carried forward ${result.platform}: ${followersToSave} followers` +
            `${totalLikesToSave != null ? `, ${totalLikesToSave} likes` : ""}` +
            `${postsCountToSave != null ? `, ${postsCountToSave} posts` : ""}` +
            `${result.error ? ` (scrape error: ${result.error})` : ""}`
        );
      }

      await client.query(
        `INSERT INTO follower_history (account_id, followers, total_likes, posts_count, recorded_date)
         VALUES ($1, $2, $3, $4, timezone($5, now())::date)
         ON CONFLICT (account_id, recorded_date)
         DO UPDATE SET
           followers = EXCLUDED.followers,
           total_likes = COALESCE(EXCLUDED.total_likes, follower_history.total_likes),
           posts_count = COALESCE(EXCLUDED.posts_count, follower_history.posts_count),
           created_at = CURRENT_TIMESTAMP`,
        [
          accountId,
          followersToSave,
          totalLikesToSave,
          postsCountToSave,
          appTimeZone,
        ]
      );

      console.log(
        `Saved ${result.platform}: ${followersToSave} followers${totalLikesToSave != null ? `, ${totalLikesToSave} likes` : ""}${postsCountToSave != null ? `, ${postsCountToSave} posts` : ""}`
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  console.log("Starting scrape job...\n");
  const results = await scrapeAll();
  console.log("\nSaving to database...");
  await saveResults(results);
  console.log("\nDone!");
}

// Run main() when executed directly (e.g. npm run scrape) or in CI (e.g. GitHub Actions).
// Do not run when imported by the API route or during Vercel build (no Chromium there).
const isRunDirectly =
  typeof require !== "undefined" && require.main === module;
const isCI = process.env.CI === "true";
if ((isRunDirectly || isCI) && !process.env.VERCEL) {
  main().catch((err) => {
    console.error("Scrape job failed:", err);
    process.exit(1);
  });
}
