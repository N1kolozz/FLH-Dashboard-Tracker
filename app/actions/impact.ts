"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";

export interface ImpactRecordRow {
  id: number;
  project_id: number | null;
  project_name: string;
  activity_type: string;
  people_reached: number;
  date: string;
  result_summary: string;
  evidence_link: string;
  created_at: string;
}

async function getProjectName(projectId: number) {
  const res = await pool.query("SELECT name FROM projects WHERE id = $1", [projectId]);

  if (res.rows.length === 0) {
    return null;
  }

  return String(res.rows[0].name);
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
      `SELECT
         ir.id,
         ir.project_id,
         COALESCE(p.name, ir.project_name) AS project_name,
         ir.activity_type,
         ir.people_reached,
         ir.date::text,
         COALESCE(ir.result_summary, '') AS result_summary,
         COALESCE(ir.evidence_link, '') AS evidence_link,
         ir.created_at
       FROM impact_records ir
       LEFT JOIN projects p ON p.id = ir.project_id
       ORDER BY ir.date DESC, ir.created_at DESC`
    );
    return { success: true, records: res.rows as ImpactRecordRow[] };
  } catch (error) {
    console.error("Error fetching impact records:", error);
    return { error: "Failed to fetch impact records" };
  }
}

export async function createImpactRecord(data: {
  projectId: number;
  activityType: string;
  peopleReached: number;
  date: string;
  resultSummary: string;
  evidenceLink: string;
}) {
  try {
    await assertCanEdit();
    const projectName = await getProjectName(data.projectId);

    if (!projectName) {
      return { error: "Project not found" };
    }

    const res = await pool.query(
      `INSERT INTO impact_records (
         project_id,
         project_name,
         activity_type,
         people_reached,
         date,
         result_summary,
         evidence_link
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
      [
        data.projectId,
        projectName,
        data.activityType,
        data.peopleReached,
        data.date,
        data.resultSummary,
        data.evidenceLink,
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
    projectId: number;
    activityType: string;
    peopleReached: number;
    date: string;
    resultSummary: string;
    evidenceLink: string;
  }
) {
  try {
    await assertCanEdit();
    const projectName = await getProjectName(data.projectId);

    if (!projectName) {
      return { error: "Project not found" };
    }

    await pool.query(
      `UPDATE impact_records
       SET project_id=$1,
           project_name=$2,
           activity_type=$3,
           people_reached=$4,
           date=$5,
           result_summary=$6,
           evidence_link=$7
       WHERE id=$8`,
      [
        data.projectId,
        projectName,
        data.activityType,
        data.peopleReached,
        data.date,
        data.resultSummary,
        data.evidenceLink,
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
