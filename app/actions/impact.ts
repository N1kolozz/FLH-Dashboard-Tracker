"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";

export interface ImpactRecordRow {
  id: number;
  project_name: string;
  activity_type: string;
  people_reached: number;
  date: string;
  notes: string;
  created_at: string;
}

async function assertCanEdit() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "ADMIN" &&
      session.role !== "HEAD" &&
      session.department !== "Projects")
  ) {
    throw new Error("Not authorized");
  }
  return session;
}

export async function getImpactRecords() {
  try {
    const res = await pool.query(
      "SELECT id, project_name, activity_type, people_reached, date::text, notes, created_at FROM impact_records ORDER BY date DESC, created_at DESC"
    );
    return { success: true, records: res.rows as ImpactRecordRow[] };
  } catch (error) {
    console.error("Error fetching impact records:", error);
    return { error: "Failed to fetch impact records" };
  }
}

export async function createImpactRecord(data: {
  projectName: string;
  activityType: string;
  peopleReached: number;
  date: string;
  notes: string;
}) {
  try {
    await assertCanEdit();
    const res = await pool.query(
      `INSERT INTO impact_records (project_name, activity_type, people_reached, date, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [
        data.projectName,
        data.activityType,
        data.peopleReached,
        data.date,
        data.notes,
      ]
    );
    const createdAt = res.rows[0].created_at;

    return {
      success: true,
      id: res.rows[0].id as number,
      createdAt:
        createdAt instanceof Date
          ? createdAt.toISOString()
          : String(createdAt),
    };
  } catch (error) {
    console.error("Error creating impact record:", error);
    return { error: "Failed to create impact record" };
  }
}

export async function updateImpactRecord(
  id: number,
  data: {
    projectName: string;
    activityType: string;
    peopleReached: number;
    date: string;
    notes: string;
  }
) {
  try {
    await assertCanEdit();
    await pool.query(
      `UPDATE impact_records SET project_name=$1, activity_type=$2, people_reached=$3, date=$4, notes=$5 WHERE id=$6`,
      [
        data.projectName,
        data.activityType,
        data.peopleReached,
        data.date,
        data.notes,
        id,
      ]
    );
    return { success: true };
  } catch (error) {
    console.error("Error updating impact record:", error);
    return { error: "Failed to update impact record" };
  }
}

export async function deleteImpactRecord(id: number) {
  try {
    await assertCanEdit();
    await pool.query("DELETE FROM impact_records WHERE id = $1", [id]);
    return { success: true };
  } catch (error) {
    console.error("Error deleting impact record:", error);
    return { error: "Failed to delete impact record" };
  }
}
