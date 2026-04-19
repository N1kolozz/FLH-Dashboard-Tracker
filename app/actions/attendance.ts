"use server";

import { pool } from "@/lib/db";
import { getSession, type Session } from "@/lib/auth";
import { assertCanManageAttendance } from "@/lib/permissions";
import {
  AttendanceStatus,
  AttendanceSessionRow,
  AttendanceRecordRow,
  AttendancePromptRow,
  MemberAttendanceStat,
  DepartmentAttendanceStat,
  AttendanceStats,
} from "@/types";

const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "pending",
  "present",
  "absent",
  "excused",
];

const ATTENDANCE_AUDIENCE_CONDITION = `
  (
    s.event_id IS NULL
    OR (
      e.id IS NOT NULL
      AND (
        LOWER(COALESCE(e.department, 'all')) = 'all'
        OR LOWER(COALESCE(e.department, '')) = LOWER(u.department)
        OR (LOWER(e.department) = 'pr' AND u.department = 'PR & Social')
        OR (LOWER(e.department) = 'logistics' AND u.department = 'Logistics')
        OR (LOWER(e.department) = 'projects' AND u.department = 'Projects')
        OR (LOWER(e.department) = 'management' AND u.department = 'Management')
        OR (LOWER(e.department) = 'other' AND u.department = 'Other')
      )
      AND NOT (
        u.id = ANY(
          COALESCE(
            NULLIF(e.owner_user_ids, '{}'),
            CASE
              WHEN e.owner_user_id IS NULL THEN '{}'::INTEGER[]
              ELSE ARRAY[e.owner_user_id]
            END
          )
        )
      )
    )
  )
`;



function normalizeStatus(status: string): AttendanceStatus {
  if (ATTENDANCE_STATUSES.includes(status as AttendanceStatus)) {
    return status as AttendanceStatus;
  }
  return "pending";
}

function getSessionUserId(session: Session) {
  const userId = Number(session.userId);
  return Number.isInteger(userId) ? userId : null;
}

async function syncAttendanceRecords(sessionId?: number) {
  await pool.query(
    `DELETE FROM attendance_records r
     WHERE ($1::INTEGER IS NULL OR r.session_id = $1)
       AND NOT EXISTS (
         SELECT 1
         FROM attendance_sessions s
         LEFT JOIN events e ON e.id = s.event_id
         JOIN users u ON u.id = r.user_id
         WHERE s.id = r.session_id
           AND ${ATTENDANCE_AUDIENCE_CONDITION}
       )`,
    [sessionId ?? null]
  );

  await pool.query(
    `INSERT INTO attendance_records (session_id, user_id)
     SELECT s.id, u.id
     FROM attendance_sessions s
     LEFT JOIN events e ON e.id = s.event_id
     CROSS JOIN users u
     WHERE ($1::INTEGER IS NULL OR s.id = $1)
       AND ${ATTENDANCE_AUDIENCE_CONDITION}
     ON CONFLICT (session_id, user_id) DO NOTHING`,
    [sessionId ?? null]
  );
}

async function getEventDefaults(eventId: number | null) {
  if (!eventId) {
    return { title: "", meetingDate: "" };
  }

  const eventRes = await pool.query(
    "SELECT title, date::text AS date FROM events WHERE id = $1",
    [eventId]
  );
  const event = eventRes.rows[0] as { title: string; date: string } | undefined;
  return {
    title: event?.title ?? "",
    meetingDate: event?.date ?? "",
  };
}

export async function getAttendanceSessions() {
  try {
    const session = await getSession();
    assertCanManageAttendance(session);
    await syncAttendanceRecords();

    const res = await pool.query(
      `SELECT
         s.id,
         s.event_id,
         e.title AS event_title,
         e.date::text AS event_date,
         s.title,
         s.meeting_date::text,
         COALESCE(s.instructions, '') AS instructions,
         s.is_active,
         s.created_by_user_id,
         s.created_at,
         s.updated_at,
         COUNT(r.id)::int AS total_members,
         COUNT(r.id) FILTER (WHERE r.status = 'pending')::int AS pending_count,
         COUNT(r.id) FILTER (WHERE r.status = 'present')::int AS present_count,
         COUNT(r.id) FILTER (WHERE r.status = 'absent')::int AS absent_count,
         COUNT(r.id) FILTER (WHERE r.status = 'excused')::int AS excused_count
       FROM attendance_sessions s
       LEFT JOIN events e ON e.id = s.event_id
       LEFT JOIN attendance_records r ON r.session_id = s.id
       GROUP BY s.id, e.id
       ORDER BY s.meeting_date DESC, s.created_at DESC`
    );

    return { success: true, sessions: res.rows as AttendanceSessionRow[] };
  } catch (error) {
    console.error("Error fetching attendance sessions:", error);
    return { error: "Failed to fetch attendance sessions" };
  }
}

export async function getAttendanceSessionDetails(id: number) {
  try {
    const session = await getSession();
    assertCanManageAttendance(session);
    await syncAttendanceRecords(id);

    const sessionRes = await pool.query(
      `SELECT
         s.id,
         s.event_id,
         e.title AS event_title,
         e.date::text AS event_date,
         s.title,
         s.meeting_date::text,
         COALESCE(s.instructions, '') AS instructions,
         s.is_active,
         s.created_by_user_id,
         s.created_at,
         s.updated_at,
         COUNT(r.id)::int AS total_members,
         COUNT(r.id) FILTER (WHERE r.status = 'pending')::int AS pending_count,
         COUNT(r.id) FILTER (WHERE r.status = 'present')::int AS present_count,
         COUNT(r.id) FILTER (WHERE r.status = 'absent')::int AS absent_count,
         COUNT(r.id) FILTER (WHERE r.status = 'excused')::int AS excused_count
       FROM attendance_sessions s
       LEFT JOIN events e ON e.id = s.event_id
       LEFT JOIN attendance_records r ON r.session_id = s.id
       WHERE s.id = $1
       GROUP BY s.id, e.id`,
      [id]
    );

    if (sessionRes.rows.length === 0) {
      return { error: "Attendance session not found" };
    }

    const recordsRes = await pool.query(
      `SELECT
         r.id,
         r.session_id,
         r.user_id,
         u.full_name AS member_name,
         u.email AS member_email,
         u.department,
         COALESCE(u.position, '') AS position,
         u.role,
         r.status,
         COALESCE(r.note, '') AS note,
         COALESCE(r.reason, '') AS reason,
         r.responded_at,
         r.updated_at
       FROM attendance_records r
       JOIN users u ON u.id = r.user_id
       WHERE r.session_id = $1
       ORDER BY u.department ASC, u.full_name ASC`,
      [id]
    );

    return {
      success: true,
      session: sessionRes.rows[0] as AttendanceSessionRow,
      records: recordsRes.rows as AttendanceRecordRow[],
    };
  } catch (error) {
    console.error("Error fetching attendance details:", error);
    return { error: "Failed to fetch attendance details" };
  }
}

export async function createAttendanceSession(data: {
  eventId: number | null;
  title: string;
  meetingDate: string;
  instructions: string;
  isActive: boolean;
}) {
  try {
    const tempSession = await getSession();
    const session = assertCanManageAttendance(tempSession);
    const eventId =
      typeof data.eventId === "number" && Number.isInteger(data.eventId)
        ? data.eventId
        : null;
    const eventDefaults = await getEventDefaults(eventId);
    const title = data.title.trim() || eventDefaults.title;
    const meetingDate = data.meetingDate || eventDefaults.meetingDate;

    if (!title || !meetingDate) {
      return { error: "Title and meeting date are required" };
    }

    const createdBy = getSessionUserId(session);
    const res = await pool.query(
      `INSERT INTO attendance_sessions (
         event_id,
         title,
         meeting_date,
         instructions,
         is_active,
         created_by_user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at, updated_at`,
      [
        eventId,
        title,
        meetingDate,
        data.instructions.trim(),
        data.isActive,
        createdBy,
      ]
    );

    const id = res.rows[0].id as number;
    await syncAttendanceRecords(id);

    return {
      success: true,
      id,
      createdAt:
        res.rows[0].created_at instanceof Date
          ? res.rows[0].created_at.toISOString()
          : String(res.rows[0].created_at),
      updatedAt:
        res.rows[0].updated_at instanceof Date
          ? res.rows[0].updated_at.toISOString()
          : String(res.rows[0].updated_at),
    };
  } catch (error) {
    console.error("Error creating attendance session:", error);
    return { error: "Failed to create attendance session" };
  }
}

export async function updateAttendanceSession(
  id: number,
  data: {
    eventId: number | null;
    title: string;
    meetingDate: string;
    instructions: string;
    isActive: boolean;
  }
) {
  try {
    const session = await getSession();
    assertCanManageAttendance(session);
    const eventId =
      typeof data.eventId === "number" && Number.isInteger(data.eventId)
        ? data.eventId
        : null;
    const eventDefaults = await getEventDefaults(eventId);
    const title = data.title.trim() || eventDefaults.title;
    const meetingDate = data.meetingDate || eventDefaults.meetingDate;

    if (!title || !meetingDate) {
      return { error: "Title and meeting date are required" };
    }

    await pool.query(
      `UPDATE attendance_sessions
       SET event_id = $1,
           title = $2,
           meeting_date = $3,
           instructions = $4,
           is_active = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        eventId,
        title,
        meetingDate,
        data.instructions.trim(),
        data.isActive,
        id,
      ]
    );
    await syncAttendanceRecords(id);

    return { success: true };
  } catch (error) {
    console.error("Error updating attendance session:", error);
    return { error: "Failed to update attendance session" };
  }
}

export async function deleteAttendanceSession(id: number) {
  try {
    const session = await getSession();
    assertCanManageAttendance(session);
    await pool.query("DELETE FROM attendance_sessions WHERE id = $1", [id]);
    return { success: true };
  } catch (error) {
    console.error("Error deleting attendance session:", error);
    return { error: "Failed to delete attendance session" };
  }
}

export async function setAttendanceSessionActive(id: number, isActive: boolean) {
  try {
    const session = await getSession();
    assertCanManageAttendance(session);
    await syncAttendanceRecords(id);
    await pool.query(
      `UPDATE attendance_sessions
       SET is_active = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [isActive, id]
    );
    return { success: true };
  } catch (error) {
    console.error("Error updating attendance activation:", error);
    return { error: "Failed to update attendance activation" };
  }
}

export async function updateAttendanceRecord(
  sessionId: number,
  userId: number,
  data: {
    status: AttendanceStatus;
    note: string;
    reason: string;
  }
) {
  try {
    const tempSession = await getSession();
    const session = assertCanManageAttendance(tempSession);
    const updatedBy = getSessionUserId(session);
    const status = normalizeStatus(data.status);

    const audienceRes = await pool.query(
      `SELECT 1
       FROM attendance_sessions s
       LEFT JOIN events e ON e.id = s.event_id
       JOIN users u ON u.id = $2
       WHERE s.id = $1
         AND ${ATTENDANCE_AUDIENCE_CONDITION}`,
      [sessionId, userId]
    );
    if (audienceRes.rows.length === 0) {
      return { error: "Member is not in this attendance audience" };
    }

    const res = await pool.query(
      `INSERT INTO attendance_records (
         session_id,
         user_id,
         status,
         note,
         reason,
         updated_by_user_id,
         responded_at,
         updated_at
       )
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         CASE WHEN $3 = 'pending' THEN NULL ELSE CURRENT_TIMESTAMP END,
         CURRENT_TIMESTAMP
       )
       ON CONFLICT (session_id, user_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         note = EXCLUDED.note,
         reason = EXCLUDED.reason,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         responded_at = CASE
           WHEN EXCLUDED.status = 'pending' THEN attendance_records.responded_at
           ELSE COALESCE(attendance_records.responded_at, CURRENT_TIMESTAMP)
         END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        sessionId,
        userId,
        status,
        data.note.trim(),
        data.reason.trim(),
        updatedBy,
      ]
    );

    return { success: true, id: res.rows[0].id as number };
  } catch (error) {
    console.error("Error updating attendance record:", error);
    return { error: "Failed to update attendance record" };
  }
}

export async function getPendingAttendancePrompt() {
  try {
    const session = await getSession();
    if (!session) {
      return { success: true, prompt: null };
    }

    const userId = getSessionUserId(session);
    if (!userId) {
      return { success: true, prompt: null };
    }

    await pool.query(
      `INSERT INTO attendance_records (session_id, user_id)
       SELECT s.id, $1
       FROM attendance_sessions s
       LEFT JOIN events e ON e.id = s.event_id
       JOIN users u ON u.id = $1
       WHERE s.is_active = TRUE
         AND ${ATTENDANCE_AUDIENCE_CONDITION}
       ON CONFLICT (session_id, user_id) DO NOTHING`,
      [userId]
    );

    const res = await pool.query(
      `SELECT
         s.id AS session_id,
         s.title,
         s.meeting_date::text,
         COALESCE(s.instructions, '') AS instructions,
         e.title AS event_title,
         e.date::text AS event_date,
         e.time AS event_time,
         e.end_time AS event_end_time,
         e.location AS event_location
       FROM attendance_sessions s
       JOIN attendance_records r ON r.session_id = s.id
       LEFT JOIN events e ON e.id = s.event_id
       JOIN users u ON u.id = r.user_id
       WHERE s.is_active = TRUE
         AND r.user_id = $1
         AND r.status = 'pending'
         AND ${ATTENDANCE_AUDIENCE_CONDITION}
       ORDER BY s.meeting_date ASC, s.created_at ASC
       LIMIT 1`,
      [userId]
    );

    return {
      success: true,
      prompt:
        res.rows.length > 0
          ? (res.rows[0] as AttendancePromptRow)
          : null,
    };
  } catch (error) {
    console.error("Error fetching attendance prompt:", error);
    return { error: "Failed to fetch attendance prompt" };
  }
}

export async function submitMyAttendance(
  sessionId: number,
  data: {
    status: Exclude<AttendanceStatus, "pending">;
    note: string;
    reason: string;
  }
) {
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Not authorized" };
    }

    const userId = getSessionUserId(session);
    if (!userId) {
      return { error: "Not authorized" };
    }

    const status = normalizeStatus(data.status);
    if (status === "pending") {
      return { error: "Please choose an attendance status" };
    }

    if ((status === "absent" || status === "excused") && !data.reason.trim()) {
      return { error: "Please add a reason before submitting" };
    }

    const activeRes = await pool.query(
      `SELECT 1
       FROM attendance_sessions s
       LEFT JOIN events e ON e.id = s.event_id
       JOIN users u ON u.id = $2
       WHERE s.id = $1
         AND s.is_active = TRUE
         AND ${ATTENDANCE_AUDIENCE_CONDITION}`,
      [sessionId, userId]
    );
    if (activeRes.rows.length === 0) {
      return { error: "Attendance request is no longer active" };
    }

    await pool.query(
      `INSERT INTO attendance_records (
         session_id,
         user_id,
         status,
         note,
         reason,
         responded_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (session_id, user_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         note = EXCLUDED.note,
         reason = EXCLUDED.reason,
         responded_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [
        sessionId,
        userId,
        status,
        data.note.trim(),
        data.reason.trim(),
      ]
    );

    return { success: true };
  } catch (error) {
    console.error("Error submitting attendance:", error);
    return { error: "Failed to submit attendance" };
  }
}

export async function getAttendanceStats() {
  try {
    const session = await getSession();
    assertCanManageAttendance(session);
    await syncAttendanceRecords();

    const [summaryRes, memberRes, departmentRes] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(DISTINCT s.id)::int AS session_count,
           COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = TRUE)::int AS active_session_count,
           COUNT(r.id) FILTER (WHERE r.status <> 'pending')::int AS recorded_count,
           COUNT(r.id) FILTER (WHERE r.status = 'present')::int AS present_count,
           COUNT(r.id) FILTER (WHERE r.status = 'absent')::int AS absent_count,
           COUNT(r.id) FILTER (WHERE r.status = 'excused')::int AS excused_count,
           COUNT(r.id) FILTER (WHERE r.status = 'pending')::int AS pending_count,
           ROUND(
             (COUNT(r.id) FILTER (WHERE r.status = 'present'))::numeric * 100 /
             NULLIF((COUNT(r.id) FILTER (WHERE r.status <> 'pending'))::numeric, 0),
             1
           )::float AS average_attendance_rate
         FROM attendance_sessions s
         LEFT JOIN attendance_records r ON r.session_id = s.id`
      ),
      pool.query(
        `SELECT
           u.id AS user_id,
           u.full_name AS member_name,
           u.department,
           COUNT(r.id) FILTER (WHERE r.status <> 'pending')::int AS recorded_count,
           COUNT(r.id) FILTER (WHERE r.status = 'present')::int AS present_count,
           COUNT(r.id) FILTER (WHERE r.status = 'absent')::int AS absent_count,
           COUNT(r.id) FILTER (WHERE r.status = 'excused')::int AS excused_count,
           ROUND(
             (COUNT(r.id) FILTER (WHERE r.status = 'present'))::numeric * 100 /
             NULLIF((COUNT(r.id) FILTER (WHERE r.status <> 'pending'))::numeric, 0),
             1
           )::float AS attendance_rate
         FROM users u
         LEFT JOIN attendance_records r ON r.user_id = u.id
         GROUP BY u.id
         ORDER BY attendance_rate DESC NULLS LAST, recorded_count DESC, u.full_name ASC`
      ),
      pool.query(
        `SELECT
           u.department,
           COUNT(r.id) FILTER (WHERE r.status <> 'pending')::int AS recorded_count,
           COUNT(r.id) FILTER (WHERE r.status = 'present')::int AS present_count,
           COUNT(r.id) FILTER (WHERE r.status = 'absent')::int AS absent_count,
           COUNT(r.id) FILTER (WHERE r.status = 'excused')::int AS excused_count,
           ROUND(
             (COUNT(r.id) FILTER (WHERE r.status = 'present'))::numeric * 100 /
             NULLIF((COUNT(r.id) FILTER (WHERE r.status <> 'pending'))::numeric, 0),
             1
           )::float AS attendance_rate
         FROM users u
         LEFT JOIN attendance_records r ON r.user_id = u.id
         GROUP BY u.department
         ORDER BY u.department ASC`
      ),
    ]);

    const summary = summaryRes.rows[0] as Omit<
      AttendanceStats,
      "member_stats" | "department_stats"
    >;

    return {
      success: true,
      stats: {
        ...summary,
        member_stats: memberRes.rows as MemberAttendanceStat[],
        department_stats: departmentRes.rows as DepartmentAttendanceStat[],
      } satisfies AttendanceStats,
    };
  } catch (error) {
    console.error("Error fetching attendance stats:", error);
    return { error: "Failed to fetch attendance stats" };
  }
}
