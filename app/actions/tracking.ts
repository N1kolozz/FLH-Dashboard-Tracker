"use server";

import { headers } from "next/headers";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { log } from "@/lib/logger";

// â”€â”€ 30-Day Data Retention Cleanup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Runs at most once every 24 hours to keep the DB clean.
const RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
let lastCleanupTime = 0;

async function cleanupOldData() {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) return;
  lastCleanupTime = now;

  try {
    await Promise.all([
      pool.query(
        `DELETE FROM user_activities WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${RETENTION_DAYS} days'`
      ),
      pool.query(
        `DELETE FROM user_sessions WHERE start_time < CURRENT_TIMESTAMP - INTERVAL '${RETENTION_DAYS} days'`
      ),
    ]);
  } catch (error) {
    log.error("Error cleaning up old tracking data", error);
  }
}

export async function pingSession() {
  try {
    // Run 30-day data retention cleanup (rate-limited to once per 24h)
    cleanupOldData();

    const session = await getSession();
    if (!session?.userId || session.role === "ADMIN") return;

    const headersList = headers();
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    // Find the most recent session from the last 5 minutes (to handle page refreshes)
    const resSession = await pool.query(
      `SELECT id, start_time FROM user_sessions 
       WHERE user_id = $1 
         AND last_ping >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
       ORDER BY start_time DESC LIMIT 1`,
      [session.userId]
    );

    if (resSession.rows.length > 0) {
      // Update existing session ping and calculate duration
      const sessionId = resSession.rows[0].id;
      await pool.query(
        `UPDATE user_sessions 
         SET last_ping = CURRENT_TIMESTAMP, 
             duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)),
             ip_address = $1,
             user_agent = $2,
             is_active = TRUE
         WHERE id = $3`,
        [ipAddress, userAgent, sessionId]
      );
    } else {
      // End any lingering active sessions before opening a new one.
      // This handles the case where pagehide never fired (crash, killed tab, etc.)
      await pool.query(
        `UPDATE user_sessions
         SET is_active = FALSE,
             last_ping = CURRENT_TIMESTAMP,
             duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))
         WHERE user_id = $1 AND is_active = TRUE`,
        [session.userId]
      );
      // Create new session
      await pool.query(
        `INSERT INTO user_sessions (user_id, ip_address, user_agent, is_active)
         VALUES ($1, $2, $3, TRUE)`,
        [session.userId, ipAddress, userAgent]
      );
    }
  } catch (error) {
    log.error("Error pinging session", error);
  }
}

export async function trackPageView(path: string) {
  await logActivity("page_view", path);
}

export async function endSession() {
  try {
    const session = await getSession();
    if (!session?.userId || session.role === "ADMIN") return;

    await pool.query(
      `UPDATE user_sessions 
       SET is_active = FALSE,
           last_ping = CURRENT_TIMESTAMP,
           duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))
       WHERE user_id = $1 AND is_active = TRUE`,
      [session.userId]
    );
  } catch (error) {
    log.error("Error ending session", error);
  }
}
