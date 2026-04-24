import { headers } from "next/headers";
import { pool } from "./db";
import { getSession } from "@/lib/auth";

/**
 * Log a user activity
 */
export async function logActivity(
  action: string,
  path: string = "",
  details: Record<string, unknown> = {},
  overrideUserId?: number
) {
  try {
    const session = await getSession();
    
    // Don't track admins
    if (session?.role === "ADMIN") {
      return;
    }

    let userId = overrideUserId;
    if (!userId) {
      userId = session?.userId ? Number(session.userId) : undefined;
    }
    
    if (!userId) return;

    const headersList = headers();
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    // 1. Try to find the active user_session for this user
    // We update last_ping and duration_seconds for the current session.
    let sessionId: number | null = null;
    
    // Find the latest active session created in the last 12 hours
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
    console.error("Failed to log activity:", error);
  }
}
