"use server";

import { pool } from "@/lib/db";
import { requireDepartmentManagerSession } from "@/lib/action-auth";
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
        Array.from(new Set(data.ownerUserIds)).filter((id) => Number.isInteger(id)),
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
    await pool.query(
      `UPDATE events
       SET title=$1, date=$2, time=$3, end_time=$4, location=$5, department=$6, description=$7, owner_user_ids=$8
       WHERE id=$9`,
      [
        data.title,
        data.date,
        data.time,
        data.endTime,
        data.location,
        data.department,
        data.description,
        Array.from(new Set(data.ownerUserIds)).filter((ownerId) => Number.isInteger(ownerId)),
        id,
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
