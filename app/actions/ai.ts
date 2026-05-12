"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { requireAuthenticatedSession } from "@/lib/action-auth";
import { getSessionUserId } from "@/lib/permissions";

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
    console.error("Daily Briefing lookup error:", error);
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

    const model = genAI.getGenerativeModel({ model: "gemma-4-31b-it" });

    const systemInstruction = `You are an expert event planner AI. You help generate structured event itineraries and logistics details based on brief user inputs.
You MUST output all text (title, description, and location) in grammatically correct, formal Georgian language (ქართული).

CRITICAL GEORGIAN TERMINOLOGY RULES:
- ALWAYS use the word "ღონისძიება" (event) and its correct forms (e.g., "ღონისძიების"). NEVER use incorrect forms like "ღონისმევის".
- ALWAYS use the word "ლოჯისტიკა" (logistics). NEVER use "ლოგისტიკა".
- Ensure spelling, grammar, and phrasing are perfectly natural in Georgian.

You MUST output a valid JSON object with EXACTLY the following fields:
- "title": A short, professional title for the event in Georgian (string).
- "department": One of the following exact string values representing the best fit: "pr", "logistics", "projects", "all", "other".
- "description": A detailed itinerary, list of required logistics/equipment, and team roles, formatted professionally with line breaks, in Georgian (string).
- "location": A short string representing the location in Georgian if mentioned, or "" (empty string).
- "time": A suggested start time in HH:mm format (e.g., "09:00" or "14:30") if implied, or "" (empty string).
- "endTime": A suggested end time in HH:mm format, or "" (empty string).

Do NOT include any markdown formatting. Return strictly the raw JSON object.`;

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "user", parts: [{ text: `Generate event details for this idea: ${prompt}` }] }
      ]
    });
    
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
    console.error("AI Generation error:", error);
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
          (SELECT COUNT(*) FROM inventory_items) as inventory,
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
    const inventoryCount = parseInt(stats.inventory);
    const eventCount = parseInt(stats.events);

    // Time-appropriate greeting hint
    const hour = getBriefingHour();
    let timeOfDay = "დილა";
    if (hour >= 12 && hour < 18) timeOfDay = "შუადღე";
    else if (hour >= 18) timeOfDay = "საღამო";

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

    const prompt = `დაწერე მოკლე დღიური ბრიფინგი (2-3 წინადადება) ქართულ ენაზე "FLHUB"-ის გუნდის წევრებისთვის.

მონაცემები:
- აქტიური პროექტები: ${projectCount}
- ინვენტარის ერთეულები: ${inventoryCount}
- მომავალი ღონისძიებები: ${eventCount}
- ბოლო 24 საათში აქტიური მომხმარებლები: ${activeUsers.length > 0 ? activeUsers.join(", ") : "არცერთი"}
- სესიები ბოლო 24 საათში: ${sessionCount}
- დღის დრო: ${timeOfDay}

დაიწყე მისალმებით ("${timeOfDay} მშვიდობისა!"). მხოლოდ ქართული ენა. არანაირი markdown. მხოლოდ ბრიფინგის ტექსტი.`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Clean up any stray markdown
    text = text.replace(/[*#`]/g, '').trim();

    const saved = await client.query<DailyBriefingRow>(
      `INSERT INTO daily_briefings (user_id, briefing_date, briefing)
       VALUES ($1, $2::date, $3)
       ON CONFLICT (user_id, briefing_date)
       DO UPDATE SET briefing = daily_briefings.briefing
       RETURNING briefing`,
      [userId, briefingDate, text]
    );

    await client.query("COMMIT");

    return {
      success: true,
      briefing: saved.rows[0]?.briefing ?? text,
      briefingDate,
      alreadyGenerated: false,
    };
  } catch (error: unknown) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Daily Briefing rollback error:", rollbackError);
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("Daily Briefing error:", error);
    return { success: false, error: message };
  } finally {
    client?.release();
  }
}
