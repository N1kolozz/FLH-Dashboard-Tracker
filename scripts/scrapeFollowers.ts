import { chromium, Page, BrowserContext } from "playwright";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

interface ScrapeResult {
  platform: string;
  followers: number | null;
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

async function scrapeInstagram(url: string): Promise<number | null> {
  const { context, close } = await createContext();
  try {
    const page: Page = await context.newPage();

    // Use networkidle to let the full page render including JS hydration
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });

    // Wait a moment for any dynamic rendering
    await page.waitForTimeout(3000);

    // Strategy 1: Look for the follower count in rendered page text
    // Instagram renders "X followers" in the profile header
    const pageText = await page.evaluate(() => document.body.innerText);
    const liveCount = extractFirstNumber(pageText, "followers");
    if (liveCount !== null) {
      console.log(`  [IG] Found via page text: ${liveCount}`);
      return liveCount;
    }

    // Strategy 2: Try og:description or meta description
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
        const metaCount = extractFirstNumber(content, "Followers");
        if (metaCount !== null) {
          console.log(`  [IG] Found via meta (${selector}): ${metaCount}`);
          return metaCount;
        }
      }
    }

    // Strategy 3: Look in all script tags for edge_followed_by count
    const scripts = await page.locator("script").allTextContents();
    for (const script of scripts) {
      const edgeMatch = script.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
      if (edgeMatch) {
        const count = parseInt(edgeMatch[1], 10);
        if (count > 0) {
          console.log(`  [IG] Found via script data: ${count}`);
          return count;
        }
      }
    }

    console.log("  [IG] Could not extract follower count");
    console.log(`  [IG] Page text sample: ${pageText.substring(0, 500)}`);
    return null;
  } finally {
    await close();
  }
}

async function scrapeTikTok(url: string): Promise<number | null> {
  const { context, close } = await createContext();
  try {
    const page: Page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(3000);

    // Strategy 1: data-e2e="followers-count" selector (TikTok's standard)
    const followerEl = await page
      .locator('[data-e2e="followers-count"]')
      .first()
      .textContent({ timeout: 5000 })
      .catch(() => null);
    if (followerEl) {
      const count = parseNumber(followerEl);
      if (count !== null) {
        console.log(`  [TT] Found via data-e2e selector: ${count}`);
        return count;
      }
    }

    // Strategy 2: Look in rendered page text
    const pageText = await page.evaluate(() => document.body.innerText);
    const liveCount = extractFirstNumber(pageText, "Followers");
    if (liveCount !== null) {
      console.log(`  [TT] Found via page text: ${liveCount}`);
      return liveCount;
    }

    // Strategy 3: Meta description
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:description"]',
    ]) {
      const content = await page
        .locator(selector)
        .first()
        .getAttribute("content")
        .catch(() => null);
      if (content) {
        const metaCount = extractFirstNumber(content, "Followers");
        if (metaCount !== null) {
          console.log(`  [TT] Found via meta: ${metaCount}`);
          return metaCount;
        }
      }
    }

    // Strategy 4: Look inside SIGI_STATE script for follower count
    const scripts = await page.locator("script").allTextContents();
    for (const script of scripts) {
      const match = script.match(/"followerCount"\s*:\s*(\d+)/);
      if (match) {
        const count = parseInt(match[1], 10);
        if (count > 0) {
          console.log(`  [TT] Found via script data: ${count}`);
          return count;
        }
      }
    }

    console.log("  [TT] Could not extract follower count");
    console.log(`  [TT] Page text sample: ${pageText.substring(0, 500)}`);
    return null;
  } finally {
    await close();
  }
}

async function scrapeFacebook(url: string): Promise<number | null> {
  const { context, close } = await createContext();
  try {
    const page: Page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(3000);

    // Strategy 1: Rendered page text — look for followers, likes, members
    const pageText = await page.evaluate(() => document.body.innerText);
    for (const keyword of ["followers", "likes", "members"]) {
      const count = extractFirstNumber(pageText, keyword);
      if (count !== null) {
        console.log(`  [FB] Found via page text (${keyword}): ${count}`);
        return count;
      }
    }

    // Strategy 2: Meta description
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:description"]',
    ]) {
      const content = await page
        .locator(selector)
        .first()
        .getAttribute("content")
        .catch(() => null);
      if (content) {
        for (const keyword of ["followers", "likes", "members"]) {
          const count = extractFirstNumber(content, keyword);
          if (count !== null) {
            console.log(`  [FB] Found via meta (${keyword}): ${count}`);
            return count;
          }
        }
      }
    }

    // Strategy 3: Look for "people like this" or "people follow this"
    const likePatterns = [
      /([\d,. ]+)\s*people like this/i,
      /([\d,. ]+)\s*people follow this/i,
      /([\d,. ]+)\s*total followers/i,
    ];
    for (const pattern of likePatterns) {
      const match = pageText.match(pattern);
      if (match) {
        const count = parseNumber(match[1]);
        if (count !== null && count > 0) {
          console.log(`  [FB] Found via pattern: ${count}`);
          return count;
        }
      }
    }

    console.log("  [FB] Could not extract follower count");
    console.log(`  [FB] Page text sample: ${pageText.substring(0, 500)}`);
    return null;
  } finally {
    await close();
  }
}

export async function scrapeAll(): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  const scrapers: Array<{
    platform: string;
    url: string;
    fn: (url: string) => Promise<number | null>;
  }> = [
    {
      platform: "instagram",
      url: "https://www.instagram.com/future_leaders_hub/",
      fn: scrapeInstagram,
    },
    {
      platform: "tiktok",
      url: "https://www.tiktok.com/@future_leaders_hub",
      fn: scrapeTikTok,
    },
    {
      platform: "facebook",
      url: "https://www.facebook.com/profile.php?id=61556110770300",
      fn: scrapeFacebook,
    },
  ];

  for (const scraper of scrapers) {
    console.log(`Scraping ${scraper.platform}...`);
    try {
      const followers = await scraper.fn(scraper.url);
      results.push({ platform: scraper.platform, followers });
      console.log(
        `  Result: ${followers ?? "N/A (not found)"}`
      );
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`  ${scraper.platform} error: ${error}`);
      results.push({ platform: scraper.platform, followers: null, error });
    }
  }

  return results;
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
        `INSERT INTO follower_history (account_id, followers, recorded_date)
         VALUES ($1, $2, CURRENT_DATE)
         ON CONFLICT (account_id, recorded_date)
         DO UPDATE SET followers = EXCLUDED.followers, created_at = CURRENT_TIMESTAMP`,
        [accountId, result.followers]
      );

      console.log(
        `Saved ${result.platform}: ${result.followers} followers`
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

main().catch((err) => {
  console.error("Scrape job failed:", err);
  process.exit(1);
});
