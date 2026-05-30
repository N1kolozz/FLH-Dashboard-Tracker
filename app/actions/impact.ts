"use server";

import { pool } from "@/lib/db";
import { requireAuthenticatedSession, requireDepartmentManagerSession } from "@/lib/action-auth";
import { log } from "@/lib/logger";

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

export interface ImpactQuery {
  page?: number;
  pageSize?: number;
  projectId?: string; // "all" or numeric string
  activityType?: string; // "all" or a type
  startDate?: string;
  endDate?: string;
}

export interface ImpactStats {
  totalPeople: number;
  totalActivities: number;
  projectCount: number;
  unlinkedCount: number;
  byProject: [string, number][];
}

const IMPACT_PAGE_SIZE = 15;
const IMPACT_MAX_PAGE_SIZE = 100;

// Build the shared WHERE clause for both the paginated rows and the aggregate
// stats so the table and the charts always agree.
function buildImpactFilters(params?: ImpactQuery) {
  const filters: string[] = [];
  const values: unknown[] = [];
  if (params?.projectId && params.projectId !== "all") {
    const id = Number(params.projectId);
    if (Number.isInteger(id)) {
      values.push(id);
      filters.push(`ir.project_id = $${values.length}`);
    }
  }
  if (params?.activityType && params.activityType !== "all") {
    values.push(params.activityType);
    filters.push(`ir.activity_type = $${values.length}`);
  }
  if (params?.startDate) {
    values.push(params.startDate);
    filters.push(`ir.date >= $${values.length}`);
  }
  if (params?.endDate) {
    values.push(params.endDate);
    filters.push(`ir.date <= $${values.length}`);
  }
  return { whereClause: filters.length ? `WHERE ${filters.join(" AND ")}` : "", values };
}

export async function getImpactRecords(params?: ImpactQuery) {
  try {
    await requireAuthenticatedSession();
    const pageSize = Math.min(
      Math.max(1, params?.pageSize ?? IMPACT_PAGE_SIZE),
      IMPACT_MAX_PAGE_SIZE
    );
    const page = Math.max(1, params?.page ?? 1);
    const offset = (page - 1) * pageSize;
    const { whereClause, values } = buildImpactFilters(params);

    const countRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count
       FROM impact_records ir
       LEFT JOIN projects p ON p.id = ir.project_id
       ${whereClause}`,
      values
    );
    const total = Number(countRes.rows[0]?.count ?? 0);

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
       ${whereClause}
       ORDER BY ir.date DESC, ir.created_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      values
    );
    return { success: true, records: res.rows as ImpactRecordRow[], total, page, pageSize };
  } catch (error) {
    log.error("Error fetching impact records", error);
    return { error: "Failed to fetch impact records" };
  }
}

// Aggregate stats computed in SQL so the summary cards and "reach by project"
// chart reflect the full filtered dataset, not just the current page.
export async function getImpactStats(params?: ImpactQuery) {
  try {
    await requireAuthenticatedSession();
    const { whereClause, values } = buildImpactFilters(params);

    const totalsRes = await pool.query<{
      total_people: string | null;
      total_activities: string;
      project_count: string;
      unlinked_count: string;
    }>(
      `SELECT
         COALESCE(SUM(ir.people_reached), 0)::bigint AS total_people,
         COUNT(*)::int AS total_activities,
         COUNT(DISTINCT COALESCE(p.name, ir.project_name)) AS project_count,
         COUNT(*) FILTER (WHERE ir.project_id IS NULL)::int AS unlinked_count
       FROM impact_records ir
       LEFT JOIN projects p ON p.id = ir.project_id
       ${whereClause}`,
      values
    );

    const byProjectRes = await pool.query<{ name: string; total: string }>(
      `SELECT COALESCE(p.name, ir.project_name) AS name,
              COALESCE(SUM(ir.people_reached), 0)::bigint AS total
       FROM impact_records ir
       LEFT JOIN projects p ON p.id = ir.project_id
       ${whereClause}
       GROUP BY COALESCE(p.name, ir.project_name)
       ORDER BY total DESC
       LIMIT 50`,
      values
    );

    const row = totalsRes.rows[0];
    const stats: ImpactStats = {
      totalPeople: Number(row?.total_people ?? 0),
      totalActivities: Number(row?.total_activities ?? 0),
      projectCount: Number(row?.project_count ?? 0),
      unlinkedCount: Number(row?.unlinked_count ?? 0),
      byProject: byProjectRes.rows.map((r) => [r.name, Number(r.total)] as [string, number]),
    };
    return { success: true, stats };
  } catch (error) {
    log.error("Error fetching impact stats", error);
    return { error: "Failed to fetch impact stats" };
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
    await requireDepartmentManagerSession("Projects");
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
    log.error("Error creating impact record", error);
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
    await requireDepartmentManagerSession("Projects");
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
    log.error("Error updating impact record", error);
    return { error: "Failed to update impact record" };
  }
}

export async function deleteImpactRecord(id: number) {
  try {
    await requireDepartmentManagerSession("Projects");
    await pool.query("DELETE FROM impact_records WHERE id = $1", [id]);
    return { success: true };
  } catch (error) {
    log.error("Error deleting impact record", error);
    return { error: "Failed to delete impact record" };
  }
}
