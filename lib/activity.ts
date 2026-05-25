import { headers } from "next/headers";
import { pool } from "./db";
import { getSession } from "@/lib/auth";
import { log } from "@/lib/logger";

// Inserts a row into user_activities and associates it with the user's current
// open user_session row (if any). Called from server actions and the tracking
// action to record page views and mutations.
export async function logActivity(
  action: string,
  path: string = "",
  details: Record<string, unknown> = {},
  // overrideUserId lets the login/logout actions log before a session cookie exists.
  overrideUserId?: number
) {
  try {
    const session = await getSession();

    // ADMIN activity is intentionally not tracked — admins are operators, not
    // regular users, and their high-volume actions would skew activity reports.
    if (session?.role === "ADMIN") {
      return;
    }

    let userId = overrideUserId;
    if (!userId) {
      userId = session?.userId ? Number(session.userId) : undefined;
    }

    if (!userId) return;

    const headersList = await headers();
    // x-forwarded-for is set by Vercel/proxies; x-real-ip is a common nginx header.
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    // Link this activity to the user's most recent open session so the admin
    // panel can group activities per session. We don't create a session here —
    // that is handled by the tracking server action (pingSession / endSession).
    let sessionId: number | null = null;
    const resSession = await pool.query(
      `SELECT id FROM user_sessions
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY start_time DESC LIMIT 1`,
      [userId]
    );

    if (resSession.rows.length > 0) {
      sessionId = resSession.rows[0].id;
    }

    await pool.query(
      `INSERT INTO user_activities (user_id, session_id, action, path, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        sessionId,
        action,
        path,
        JSON.stringify(details),
        ipAddress,
        userAgent,
      ]
    );
  } catch (error) {
    // Never let activity logging crash a user-facing action.
    log.error("Failed to log activity", error);
  }
}
