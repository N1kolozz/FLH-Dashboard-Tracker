import { chromium, Page, BrowserContext } from "playwright";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

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

async function createContext(): Promise<{ context: BrowserContext; close: () => Promise<void> }> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
  });
  return { context, close: () => browser.close() };
}

const PAGE_OPTS = {
  waitUntil: "domcontentloaded" as const,
  timeout: 18000,
  waitAfter: 500,
};

async function scrapeInstagramWithPage(page: Page, url: string): Promise<ProfileScrape> {
  await page.goto(url, { waitUntil: PAGE_OPTS.waitUntil, timeout: PAGE_OPTS.timeout });
  await page.waitForTimeout(PAGE_OPTS.waitAfter);

  const pageText = await page.evaluate(() => document.body.innerText);
  let followers: number | null = extractFirstNumber(pageText, "followers");
  if (followers === null) {
    for (const selector of [
      'meta[property="og:description"]',
      'meta[name="description"]',
    ]) {
      const content = await page
        .locator(selector)
        .first()
        .getAttribute("content")
        .catch(() => null);
      if (content) {
        followers = extractFirstNumber(content, "Followers");
        if (followers !== null) break;
      }
    }
  }
  if (followers === null) {
    const scripts = await page.locator("script").allTextContents();
    for (const script of scripts) {
      const edgeMatch = script.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
      if (edgeMatch) {
        followers = parseInt(edgeMatch[1], 10);
        if (followers > 0) break;
      }
    }
  }
  if (followers !== null) console.log(`  [IG] followers: ${followers}`);

  let postsCount: number | null = extractFirstNumber(pageText, "posts");
  if (postsCount === null) {
    for (const selector of ['meta[property="og:description"]', 'meta[name="description"]']) {
      const content = await page.locator(selector).first().getAttribute("content").catch(() => null);
      if (content) {
        postsCount = extractFirstNumber(content, "Posts");
        if (postsCount !== null) break;
      }
    }
  }
  if (postsCount === null) {
    const scripts = await page.locator("script").allTextContents();
    for (const script of scripts) {
      const m = script.match(/"edge_owner_to_timeline_media"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
      if (m) {
        postsCount = parseInt(m[1], 10);
        break;
      }
    }
  }
  if (postsCount !== null) console.log(`  [IG] posts: ${postsCount}`);

  // Instagram profiles don't show total likes; only followers and posts
  return { followers: followers ?? null, totalLikes: null, postsCount: postsCount ?? null };
}

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

async function scrapeFacebookWithPage(page: Page, url: string): Promise<ProfileScrape> {
  await page.goto(url, { waitUntil: PAGE_OPTS.waitUntil, timeout: PAGE_OPTS.timeout });
  await page.waitForTimeout(PAGE_OPTS.waitAfter);

  const pageText = await page.evaluate(() => document.body.innerText);

  // Extract likes explicitly (Facebook profile/pages show "X likes" or "X people like this")
  let totalLikes: number | null = extractFirstNumber(pageText, "likes");
  if (totalLikes === null) {
    const likePatterns = [
      /([\d,. ]+[KkMmBb]?)\s*people like this/i,
      /([\d,. ]+[KkMmBb]?)\s*likes?\s*$/im,
      /(\d[\d,.\s]*)\s*likes/i,
    ];
    for (const pattern of likePatterns) {
      const match = pageText.match(pattern);
      if (match) {
        const count = parseNumber(match[1].trim());
        if (count !== null && count > 0) {
          totalLikes = count;
          break;
        }
      }
    }
  }
  if (totalLikes === null) {
    const content = await page
      .locator('meta[name="description"], meta[property="og:description"]')
      .first()
      .getAttribute("content")
      .catch(() => null);
    if (content) totalLikes = extractFirstNumber(content, "likes") ?? extractFirstNumber(content, "Like");
  }
  if (totalLikes !== null) console.log(`  [FB] likes: ${totalLikes}`);

  // Extract followers (may be separate from likes on some pages)
  let followers: number | null = extractFirstNumber(pageText, "followers");
  if (followers === null) {
    const followPatterns = [
      /([\d,. ]+[KkMmBb]?)\s*people follow this/i,
      /([\d,. ]+[KkMmBb]?)\s*total followers/i,
    ];
    for (const pattern of followPatterns) {
      const match = pageText.match(pattern);
      if (match) {
        const count = parseNumber(match[1].trim());
        if (count !== null && count > 0) {
          followers = count;
          break;
        }
      }
    }
  }
  if (followers === null) {
    const content = await page
      .locator('meta[name="description"], meta[property="og:description"]')
      .first()
      .getAttribute("content")
      .catch(() => null);
    if (content) followers = extractFirstNumber(content, "followers");
  }
  // For pages that only show "likes", use likes as the main follower metric
  if (followers === null && totalLikes !== null) followers = totalLikes;
  if (followers !== null) console.log(`  [FB] followers: ${followers}`);

  let postsCount: number | null = extractFirstNumber(pageText, "posts");
  if (postsCount === null) {
    const content = await page
      .locator('meta[name="description"], meta[property="og:description"]')
      .first()
      .getAttribute("content")
      .catch(() => null);
    if (content) postsCount = extractFirstNumber(content, "posts");
  }
  if (postsCount !== null) console.log(`  [FB] posts: ${postsCount}`);

  return { followers: followers ?? null, totalLikes: totalLikes ?? null, postsCount: postsCount ?? null };
}

const PLATFORMS = [
  { platform: "instagram", url: "https://www.instagram.com/future_leaders_hub/" },
  { platform: "tiktok", url: "https://www.tiktok.com/@future_leaders_hub" },
  { platform: "facebook", url: "https://www.facebook.com/profile.php?id=61556110770300" },
] as const;

export async function scrapeAll(): Promise<ScrapeResult[]> {
  const { context, close } = await createContext();
  try {
    const [pageIg, pageTt, pageFb] = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage(),
    ]);

    console.log("Scraping Instagram, TikTok, Facebook in parallel...");
    const toResult = async (
      page: Page,
      url: string,
      platform: string,
      scrape: (p: Page, u: string) => Promise<ProfileScrape>
    ): Promise<ScrapeResult> => {
      try {
        const profile = await scrape(page, url);
        return {
          platform,
          followers: profile.followers ?? null,
          total_likes: profile.totalLikes ?? null,
          posts_count: profile.postsCount ?? null,
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error(`  ${platform} error: ${error}`);
        return { platform, followers: null, total_likes: null, posts_count: null, error };
      }
    };

    const results = await Promise.all([
      toResult(pageIg, PLATFORMS[0].url, "instagram", scrapeInstagramWithPage),
      toResult(pageTt, PLATFORMS[1].url, "tiktok", scrapeTikTokWithPage),
      toResult(pageFb, PLATFORMS[2].url, "facebook", scrapeFacebookWithPage),
    ]);
    results.forEach((r) =>
      console.log(
        `  ${r.platform}: followers ${r.followers ?? "N/A"}${r.total_likes != null ? `, likes ${r.total_likes}` : ""}${r.posts_count != null ? `, posts ${r.posts_count}` : ""}${r.error ? ` (${r.error})` : ""}`
      )
    );
    return results;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("Scrape error:", error);
    return PLATFORMS.map(({ platform }) => ({
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
      if (result.followers === null) {
        console.log(`Skipping ${result.platform} — no follower count`);
        continue;
      }

      const accountRes = await client.query(
        "SELECT id FROM social_accounts WHERE platform = $1",
        [result.platform]
      );

      if (accountRes.rows.length === 0) {
        console.warn(`No account found for platform: ${result.platform}`);
        continue;
      }

      const accountId = accountRes.rows[0].id;

      await client.query(
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

      console.log(
        `Saved ${result.platform}: ${result.followers} followers${result.total_likes != null ? `, ${result.total_likes} likes` : ""}${result.posts_count != null ? `, ${result.posts_count} posts` : ""}`
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

// Run main() only when this file is executed directly (e.g. npm run scrape), not when
// imported by the API route or during Vercel build (no Chromium in build env).
const isRunDirectly =
  typeof require !== "undefined" && require.main === module;
if (isRunDirectly && !process.env.VERCEL) {
  main().catch((err) => {
    console.error("Scrape job failed:", err);
    process.exit(1);
  });
}
