"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";

export interface EventRow {
  id: number;
  title: string;
  date: string;
  time: string;
  end_time: string;
  location: string;
  department: string;
  description: string;
  created_at: string;
}

async function assertCanEdit() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "ADMIN" &&
      session.role !== "HEAD" &&
      session.department !== "Management")
  ) {
    throw new Error("Not authorized");
  }
  return session;
}

export async function getEvents() {
  try {
    const res = await pool.query(
      "SELECT id, title, date::text, time, end_time, location, department, description, created_at FROM events ORDER BY date DESC, time ASC"
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
}) {
  try {
    await assertCanEdit();
    const res = await pool.query(
      `INSERT INTO events (title, date, time, end_time, location, department, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        data.title,
        data.date,
        data.time,
        data.endTime,
        data.location,
        data.department,
        data.description,
      ]
    );
    return { success: true, id: res.rows[0].id };
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
  }
) {
  try {
    await assertCanEdit();
    await pool.query(
      `UPDATE events SET title=$1, date=$2, time=$3, end_time=$4, location=$5, department=$6, description=$7 WHERE id=$8`,
      [
        data.title,
        data.date,
        data.time,
        data.endTime,
        data.location,
        data.department,
        data.description,
        id,
      ]
    );
    return { success: true };
  } catch (error) {
    console.error("Error updating event:", error);
    return { error: "Failed to update event" };
  }
}

export async function deleteEvent(id: number) {
  try {
    await assertCanEdit();
    await pool.query("DELETE FROM events WHERE id = $1", [id]);
    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { error: "Failed to delete event" };
  }
}
