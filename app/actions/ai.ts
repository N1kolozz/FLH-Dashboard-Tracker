"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { requireAuthenticatedSession } from "@/lib/action-auth";
import { getSessionUserId } from "@/lib/permissions";
import { log } from "@/lib/logger";

// Initialize the Google Generative AI SDK
// The user will need to add GEMINI_API_KEY to their .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const BRIEFING_TIME_ZONE = "Asia/Tbilisi";
const DAILY_BRIEFING_RETENTION_DAYS = 7;

type DailyBriefingRow = {
  briefing: string;
};

export type DailyBriefingResult =
  | {
      success: true;
      briefing: string | null;
      briefingDate: string;
      alreadyGenerated: boolean;
    }
  | {
      success: false;
      error: string;
    };

function getBriefingDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRIEFING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function getBriefingHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: BRIEFING_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).format(date);

  return Number.parseInt(hour, 10);
}

function isNextDynamicServerError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE"
  );
}

async function ensureDailyBriefingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_briefings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      briefing_date DATE NOT NULL,
      briefing TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, briefing_date)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS daily_briefings_user_date_idx
    ON daily_briefings (user_id, briefing_date DESC)
  `);
}

async function cleanupOldDailyBriefings(briefingDate: string) {
  await pool.query(
    `DELETE FROM daily_briefings
     WHERE briefing_date < ($1::date - make_interval(days => $2::integer))::date`,
    [briefingDate, DAILY_BRIEFING_RETENTION_DAYS]
  );
}

// Fallback briefing used when Gemini is unavailable (rate limited, API down,
// model renamed, network failure). Returns a static, deterministic Georgian
// sentence assembled from the stats we already queried — no AI call needed.
// We do NOT persist this to the daily_briefings table so the next successful
// generation can replace it on the user's next dashboard load.
function buildFallbackBriefing(params: {
  greeting: string;
  projectCount: number;
  eventCount: number;
  activeUsersLine: string;
  sessionCount: number;
}): string {
  const { greeting, projectCount, eventCount, activeUsersLine, sessionCount } = params;
  return `${greeting}. დღეს გვაქვს ${projectCount} აქტიური პროექტი და ${eventCount} მომავალი ღონისძიება. ${activeUsersLine} ბოლო 24 საათში ${sessionCount} სესია დაფიქსირდა.`;
}

async function getAuthenticatedBriefingUserId() {
  const session = await requireAuthenticatedSession();
  const userId = getSessionUserId(session);

  if (!userId) {
    throw new Error("Not authorized: Missing user id");
  }

  return userId;
}

export async function getDailyBriefingForToday(): Promise<DailyBriefingResult> {
  try {
    const userId = await getAuthenticatedBriefingUserId();
    const briefingDate = getBriefingDateKey();

    await ensureDailyBriefingsTable();
    await cleanupOldDailyBriefings(briefingDate);

    const existing = await pool.query<DailyBriefingRow>(
      `SELECT briefing
       FROM daily_briefings
       WHERE user_id = $1 AND briefing_date = $2::date
       LIMIT 1`,
      [userId, briefingDate]
    );

    return {
      success: true,
      briefing: existing.rows[0]?.briefing ?? null,
      briefingDate,
      alreadyGenerated: existing.rows.length > 0,
    };
  } catch (error: unknown) {
    if (isNextDynamicServerError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error("Daily Briefing lookup error", error);
    return { success: false, error: message };
  }
}

export async function generateItinerary(prompt: string) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return {
        success: false,
        error: "GEMINI_API_KEY is not set in your environment variables. Please add it to your .env file."
      };
    }

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tbilisi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const systemInstruction = `You are a smart event assistant for FLH Dashboard. Extract structured event details from the user's free-form input and return a single JSON object.

CORE RULES:
1. Only populate fields the user explicitly mentioned or that can be directly inferred. Do NOT invent content.
2. For "description": write only what the user described in their own words. You may add a brief, helpful agenda or checklist ONLY when the event type genuinely benefits from it (e.g., a festival, PR campaign launch, project kick-off, workshop). For simple meetings or check-ins, keep the description short and factual.
3. Never add fabricated team roles, unmentioned equipment lists, or generic filler text.
4. All text fields (title, description, location) MUST be in formal, grammatically correct Georgian (ქართული).

DATE & TIME:
- Today is ${today}. Use this to resolve relative dates ("tomorrow", "next Friday", etc.).
- If the user states a specific date, extract it as "YYYY-MM-DD". Otherwise "".
- If the user states a start time, extract as "HH:mm" (24-hour clock). Otherwise "".
- If the user states an end time or duration, derive "endTime" as "HH:mm". Otherwise "".

DEPARTMENT — choose exactly one:
- "pr"       → PR, social media, marketing, communications, content creation
- "projects" → project management, operations, logistics, construction, technical
- "all"      → company-wide, all-hands, general / cross-department events
- "other"    → anything that doesn't clearly fit the above

OUTPUT: Return ONLY a raw JSON object, no markdown, no extra text:
{
  "title": string,
  "date": string,
  "time": string,
  "endTime": string,
  "department": "all" | "pr" | "projects" | "other",
  "location": string,
  "description": string
}`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction,
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Find the first balanced JSON object in the response
    let jsonString = "";
    const firstOpen = responseText.indexOf('{');
    if (firstOpen !== -1) {
      let depth = 0;
      for (let i = firstOpen; i < responseText.length; i++) {
        if (responseText[i] === '{') depth++;
        else if (responseText[i] === '}') {
          depth--;
          if (depth === 0) {
            jsonString = responseText.substring(firstOpen, i + 1);
            break;
          }
        }
      }
    }

    if (!jsonString) {
      throw new Error("Model did not return a valid JSON object.");
    }

    const parsed = JSON.parse(jsonString);
    return { success: true, data: parsed };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate itinerary. Please try again.";
    log.error("AI Generation error", error);
    return { success: false, error: message };
  }
}

export async function generateDailyBriefing(): Promise<DailyBriefingResult> {
  let client: PoolClient | null = null;

  try {
    if (!process.env.GEMINI_API_KEY) {
      return {
        success: false,
        error: "GEMINI_API_KEY is not set in your environment variables. Please add it to your .env file.",
      };
    }

    const userId = await getAuthenticatedBriefingUserId();
    const briefingDate = getBriefingDateKey();

    await ensureDailyBriefingsTable();
    await cleanupOldDailyBriefings(briefingDate);

    client = await pool.connect();
    await client.query("BEGIN");
    await client.query(
      `SELECT pg_advisory_xact_lock($1::integer, hashtext($2)::integer)`,
      [userId, briefingDate]
    );

    const existing = await client.query<DailyBriefingRow>(
      `SELECT briefing
       FROM daily_briefings
       WHERE user_id = $1 AND briefing_date = $2::date
       LIMIT 1`,
      [userId, briefingDate]
    );

    if (existing.rows[0]?.briefing) {
      await client.query("COMMIT");
      return {
        success: true,
        briefing: existing.rows[0].briefing,
        briefingDate,
        alreadyGenerated: true,
      };
    }

    const statsRes = await client.query(`
        SELECT
          (SELECT COUNT(*) FROM projects) as projects,
          (SELECT COUNT(*) FROM events WHERE date >= CURRENT_DATE) as events
      `);
    const activityRes = await client.query(`
        SELECT DISTINCT u.full_name
        FROM user_activities a
        JOIN users u ON a.user_id = u.id
        WHERE a.created_at >= NOW() - INTERVAL '24 hours'
        LIMIT 10
      `);
    const sessionRes = await client.query(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM user_sessions
        WHERE start_time >= NOW() - INTERVAL '24 hours'
      `);

    const stats = statsRes.rows[0];
    const activeUsers = activityRes.rows.map((r: Record<string, string>) => r.full_name).filter(Boolean);
    const sessionCount = parseInt(sessionRes.rows[0]?.count || '0');
    const projectCount = parseInt(stats.projects);
    const eventCount = parseInt(stats.events);

    // Time-appropriate greeting hint
    const hour = getBriefingHour();
    let timeOfDay = "დილა";
    let greeting = "დილა მშვიდობისა";
    if (hour >= 12 && hour < 18) { timeOfDay = "შუადღე"; greeting = "შუადღე მშვიდობისა"; }
    else if (hour >= 18) { timeOfDay = "საღამო"; greeting = "საღამო მშვიდობისა"; }

    const activeUsersLine = activeUsers.length > 0
      ? `ბოლო 24 საათში სისტემაში შემოვიდნენ: ${activeUsers.join(", ")}.`
      : "ბოლო 24 საათში სისტემაში არცერთი მომხმარებელი არ დაფიქსირებულა.";

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `შენ ხარ FLHUB-ის ასისტენტი — ქართული ღონისძიებების სააგენტოს შიდა პლატფორმა. \
დაწერე დღიური ბრიფინგი გუნდისთვის — 2-4 წინადადება, თბილი და ბუნებრივი ქართული ენით. \
ტექსტი უნდა ჟღერდეს, თითქოს ადამიანი წერს კოლეგებს და არა მანქანა — გამოიყენე ცოცხალი, ბუნებრივი ფრაზები.

დღის მონაცემები:
- ${timeOfDay === "დილა" ? "დღის დასაწყისი" : timeOfDay === "შუადღე" ? "შუადღე" : "სამუშაო დღის დასასრული"}
- აქტიური პროექტები: ${projectCount}
- მომავალი ღონისძიებები: ${eventCount}
- ${activeUsersLine}
- სესიები ბოლო 24 საათში: ${sessionCount}

დაიწყე "${greeting}"-ით. \
მხოლოდ ქართული ენა. \
არ გამოიყენო markdown, bullet point-ები ან სიები. \
დაწერე მხოლოდ ბრიფინგის ტექსტი — თანმიმდევრული პარაგრაფი.`;

    // Attempt the Gemini call. If it fails for any reason (rate limit, network,
    // model deprecation), we fall back to a deterministic Georgian briefing
    // assembled from the stats we already have. The fallback is intentionally
    // NOT persisted so the next dashboard load can retry the AI call.
    let text: string;
    let usedFallback = false;
    try {
      const result = await model.generateContent(prompt);
      text = result.response.text().trim();
      // Strip stray markdown that the model sometimes returns despite the prompt.
      text = text.replace(/[*#`]/g, '').trim();
      if (!text) throw new Error("Gemini returned empty content");
    } catch (geminiError) {
      // Surface as much detail as the SDK gives us so we can diagnose model
      // / quota / auth issues from Vercel logs. The Gemini SDK attaches the
      // HTTP status and a "status" string ("INVALID_ARGUMENT", "NOT_FOUND",
      // "RESOURCE_EXHAUSTED" for quota, "PERMISSION_DENIED" for access, …)
      // either on the error object directly or in error.message JSON.
      const err = geminiError as {
        message?: string;
        status?: number | string;
        statusText?: string;
        errorDetails?: unknown;
      };
      log.error("Gemini briefing call failed; serving fallback", geminiError, {
        userId,
        briefingDate,
        modelName: "gemini-2.5-flash-lite",
        geminiStatus: err?.status,
        geminiStatusText: err?.statusText,
        geminiMessage: err?.message,
        geminiErrorDetails: err?.errorDetails,
      });
      text = buildFallbackBriefing({
        greeting,
        projectCount,
        eventCount,
        activeUsersLine,
        sessionCount,
      });
      usedFallback = true;
    }

    // Only persist real (AI-generated) briefings. The fallback is transient.
    let storedBriefing: string = text;
    if (!usedFallback) {
      const saved = await client.query<DailyBriefingRow>(
        `INSERT INTO daily_briefings (user_id, briefing_date, briefing)
         VALUES ($1, $2::date, $3)
         ON CONFLICT (user_id, briefing_date)
         DO UPDATE SET briefing = daily_briefings.briefing
         RETURNING briefing`,
        [userId, briefingDate, text]
      );
      storedBriefing = saved.rows[0]?.briefing ?? text;
    }

    await client.query("COMMIT");

    return {
      success: true,
      briefing: storedBriefing,
      briefingDate,
      alreadyGenerated: false,
    };
  } catch (error: unknown) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        log.error("Daily Briefing rollback error", rollbackError);
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error("Daily Briefing error", error);
    return { success: false, error: message };
  } finally {
    client?.release();
  }
}
