"use server";

import { pool } from "@/lib/db";
import { requireAuthenticatedSession, requireDepartmentManagerSession } from "@/lib/action-auth";
import { normalizeOwnerUserIds } from "@/lib/owner-users";
import { createPushNotification, notifySubscribers } from "@/lib/push";
import { getSessionUserId } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export interface EventRow {
  id: number;
  title: string;
  date: string;
  time: string;
  end_time: string;
  location: string;
  department: string;
  description: string;
  owner_user_ids: number[];
  created_at: string;
}

export async function getEvents() {
  try {
    await requireAuthenticatedSession();
    const res = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.date::text,
         e.time,
         e.end_time,
         e.location,
         e.department,
         e.description,
         COALESCE(
           NULLIF(e.owner_user_ids, '{}'),
           CASE WHEN e.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[e.owner_user_id] END
         ) AS owner_user_ids,
         e.created_at
       FROM events e
       ORDER BY e.date DESC, e.time ASC`
    );
    return { success: true, events: res.rows as EventRow[] };
  } catch (error) {
    console.error("Error fetching events:", error);
    return { error: "Failed to fetch events" };
  }
}

export async function createEvent(data: {
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  department: string;
  description: string;
  ownerUserIds: number[];
}) {
  try {
    const session = await requireDepartmentManagerSession("Management");
    const actorUserId = getSessionUserId(session);
    const res = await pool.query(
      `INSERT INTO events (title, date, time, end_time, location, department, description, owner_user_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
      [
        data.title,
        data.date,
        data.time,
        data.endTime,
        data.location,
        data.department,
        data.description,
        normalizeOwnerUserIds(data.ownerUserIds),
      ]
    );
    const createdAt = res.rows[0].created_at;

    try {
      await notifySubscribers({
        topic: "events",
        excludeUserId: actorUserId,
        payload: createPushNotification({
          topic: "events",
          title: `ახალი ღონისძიება: ${data.title}`,
          body: data.date
            ? `დაგეგმილია ${data.date}${data.time ? `, ${data.time}` : ""}.`
            : "dashboard-ში ახალი ღონისძიება დაემატა.",
          url: "/events",
          tag: `event-${res.rows[0].id as number}`,
        }),
      });
    } catch (pushError) {
      console.error("Error sending event push notification:", pushError);
    }

    await logActivity("create_event", "/events", { eventId: res.rows[0].id, title: data.title }, actorUserId || undefined);

    return {
      success: true,
      id: res.rows[0].id as number,
      createdAt:
        createdAt instanceof Date
          ? createdAt.toISOString()
          : String(createdAt),
    };
  } catch (error) {
    console.error("Error creating event:", error);
    return { error: "Failed to create event" };
  }
}

function normalizeDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  return trimmed.split("T")[0].split(" ")[0];
}

function detectEventUpdateType(
  oldRow: {
    title: string;
    date: string | null;
    time: string | null;
    end_time: string | null;
    location: string | null;
    department: string | null;
    description: string | null;
  },
  next: {
    title: string;
    date: string;
    time: string;
    endTime: string;
    location: string;
    department: string;
    description: string;
  }
): string {
  if (normalizeDateOnly(oldRow.date) !== normalizeDateOnly(next.date)) return "date";
  if ((oldRow.time ?? "") !== (next.time ?? "")) return "time";
  if ((oldRow.end_time ?? "") !== (next.endTime ?? "")) return "time";
  if ((oldRow.location ?? "") !== (next.location ?? "")) return "location";
  if ((oldRow.department ?? "") !== (next.department ?? "")) return "department";
  if ((oldRow.title ?? "") !== (next.title ?? "")) return "title";
  if ((oldRow.description ?? "") !== (next.description ?? "")) return "description";
  return "details";
}

export async function updateEvent(
  id: number,
  data: {
    title: string;
    date: string;
    time: string;
    endTime: string;
    location: string;
    department: string;
    description: string;
    ownerUserIds: number[];
  }
) {
  try {
    const session = await requireDepartmentManagerSession("Management");
    const actorUserId = getSessionUserId(session);

    const oldRes = await pool.query(
      `SELECT title, date::text AS date, time, end_time, location, department, description
       FROM events WHERE id = $1`,
      [id]
    );
    const oldRow = oldRes.rows[0];
    const lastUpdateType = oldRow ? detectEventUpdateType(oldRow, data) : "details";

    await pool.query(
      `UPDATE events
       SET title=$1, date=$2, time=$3, end_time=$4, location=$5, department=$6, description=$7,
           owner_user_ids=$8, updated_at=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
           last_update_type=$10
       WHERE id=$9`,
      [
        data.title,
        data.date,
        data.time,
        data.endTime,
        data.location,
        data.department,
        data.description,
        normalizeOwnerUserIds(data.ownerUserIds),
        id,
        lastUpdateType,
      ]
    );

    try {
      await notifySubscribers({
        topic: "events",
        excludeUserId: actorUserId,
        payload: createPushNotification({
          topic: "events",
          title: `ღონისძიება განახლდა: ${data.title}`,
          body: data.date
            ? `შეამოწმეთ განახლებული გეგმა ${data.date}${data.time ? `, ${data.time}` : ""}.`
            : "dashboard-ში ღონისძიება განახლდა.",
          url: "/events",
          tag: `event-${id}`,
        }),
      });
    } catch (pushError) {
      console.error("Error sending event update notification:", pushError);
    }

    await logActivity("update_event", "/events", { eventId: id, title: data.title }, actorUserId || undefined);

    return { success: true };
  } catch (error) {
    console.error("Error updating event:", error);
    return { error: "Failed to update event" };
  }
}

export async function deleteEvent(id: number) {
  try {
    const session = await requireDepartmentManagerSession("Management");
    const actorUserId = getSessionUserId(session);
    await pool.query("DELETE FROM events WHERE id = $1", [id]);
    await logActivity("delete_event", "/events", { eventId: id }, actorUserId || undefined);
    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { error: "Failed to delete event" };
  }
}
