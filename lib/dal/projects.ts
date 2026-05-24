import { pool } from "@/lib/db";
import { normalizeOwnerUserIds } from "@/lib/owner-users";
import { ProjectRow } from "@/types";

export async function fetchAllProjects(): Promise<ProjectRow[]> {
  const res = await pool.query(
    `SELECT
       p.id,
       p.name,
       p.description,
       p.status,
       p.priority,
       p.deadline::text,
       p.team,
       p.tags,
       COALESCE(
         NULLIF(p.owner_user_ids, '{}'),
         CASE WHEN p.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[p.owner_user_id] END
       ) AS owner_user_ids,
       (p.created_at AT TIME ZONE 'UTC')::text || 'Z' as created_at,
       (p.updated_at AT TIME ZONE 'UTC')::text || 'Z' as updated_at
     FROM projects p
     ORDER BY
       CASE p.status
         WHEN 'planning' THEN 0
         WHEN 'in_progress' THEN 1
         WHEN 'review' THEN 2
         WHEN 'completed' THEN 3
         ELSE 4
       END,
       CASE p.priority
         WHEN 'high' THEN 0
         WHEN 'medium' THEN 1
         WHEN 'low' THEN 2
         ELSE 3
       END,
       p.created_at DESC`
  );
  return res.rows as ProjectRow[];
}

export async function fetchRejectedProjects() {
  const res = await pool.query(
    `SELECT
       p.id,
       p.name,
       p.description,
       p.status,
       p.priority,
       p.deadline::text,
       p.team,
       p.tags,
       COALESCE(
         NULLIF(p.owner_user_ids, '{}'),
         CASE WHEN p.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[p.owner_user_id] END
       ) AS owner_user_ids,
       (p.created_at AT TIME ZONE 'UTC')::text || 'Z' as created_at,
       (p.updated_at AT TIME ZONE 'UTC')::text || 'Z' as updated_at,
       rr.feedback AS rejection_feedback,
       u.full_name AS rejected_by_name,
       (rr.reviewed_at AT TIME ZONE 'UTC')::text || 'Z' AS rejected_at
     FROM projects p
     LEFT JOIN LATERAL (
       SELECT rr2.feedback, rr2.reviewed_by, rr2.reviewed_at
       FROM review_requests rr2
       WHERE rr2.entity_type = 'project'
         AND rr2.entity_id = p.id
         AND rr2.status = 'rejected'
       ORDER BY rr2.created_at DESC
       LIMIT 1
     ) rr ON true
     LEFT JOIN users u ON u.id = rr.reviewed_by
     WHERE p.status = 'rejected'
     ORDER BY p.updated_at DESC`
  );
  return res.rows;
}

export async function insertProject(data: {
  name: string;
  description: string;
  status: string;
  priority: string;
  deadline: string;
  team: string;
  tags: string[];
  ownerUserIds: number[];
}) {
  const res = await pool.query(
    `INSERT INTO projects (
       name,
       description,
       status,
       priority,
       deadline,
       team,
       tags,
       owner_user_ids,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
     RETURNING id, (created_at AT TIME ZONE 'UTC')::text || 'Z' as created_at, (updated_at AT TIME ZONE 'UTC')::text || 'Z' as updated_at`,
    [
      data.name,
      data.description,
      data.status,
      data.priority,
      data.deadline || null,
      data.team,
      data.tags,
      normalizeOwnerUserIds(data.ownerUserIds),
    ]
  );
  return res.rows[0];
}

function normalizeDeadline(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  // Strip time component if present (e.g. "2026-05-28T00:00:00.000Z" -> "2026-05-28")
  return trimmed.split("T")[0].split(" ")[0];
}

function detectProjectUpdateType(
  oldRow: {
    name: string;
    description: string | null;
    status: string;
    priority: string;
    deadline: string | null;
  },
  next: {
    name: string;
    description: string;
    status: string;
    priority: string;
    deadline: string;
  }
): string {
  if ((oldRow.status ?? "") !== (next.status ?? "")) return "status";
  if (normalizeDeadline(oldRow.deadline) !== normalizeDeadline(next.deadline)) return "deadline";
  if ((oldRow.priority ?? "") !== (next.priority ?? "")) return "priority";
  if ((oldRow.name ?? "") !== (next.name ?? "")) return "name";
  if ((oldRow.description ?? "") !== (next.description ?? "")) return "description";
  return "details";
}

export async function updateProjectInDB(
  id: number,
  data: {
    name: string;
    description: string;
    status: string;
    priority: string;
    deadline: string;
    team: string;
    tags: string[];
    ownerUserIds: number[];
  }
) {
  const oldRes = await pool.query(
    `SELECT name, description, status, priority, deadline::text AS deadline
     FROM projects WHERE id = $1`,
    [id]
  );
  const oldRow = oldRes.rows[0];
  const lastUpdateType = oldRow
    ? detectProjectUpdateType(oldRow, data)
    : "details";

  const res = await pool.query(
    `UPDATE projects
     SET name = $1,
         description = $2,
         status = $3,
         priority = $4,
         deadline = $5,
         team = $6,
         tags = $7,
         owner_user_ids = $8,
         updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
         last_update_type = $10
     WHERE id = $9
     RETURNING
         (updated_at AT TIME ZONE 'UTC')::text || 'Z' AS updated_at,
         last_update_type`,
    [
      data.name,
      data.description,
      data.status,
      data.priority,
      data.deadline || null,
      data.team,
      data.tags,
      normalizeOwnerUserIds(data.ownerUserIds),
      id,
      lastUpdateType,
    ]
  );
  return { ...res.rows[0], oldRow };
}

export async function deleteProjectFromDB(id: number) {
  await pool.query("DELETE FROM projects WHERE id = $1", [id]);
}
