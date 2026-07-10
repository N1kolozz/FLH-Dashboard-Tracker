// Data Access Layer (DAL) for projects.
// This module owns all raw SQL for the projects table. Server actions in
// app/actions/projects.ts call these functions rather than writing SQL inline,
// keeping the query logic in one place and making it easier to test or swap.

import { pool } from "@/lib/db";
import { normalizeOwnerUserIds } from "@/lib/owner-users";
import { ProjectRow } from "@/types";

// The kanban board needs every active card visible at once (you can't "page" a
// board), and this fetch is also shared by the portfolio overview and the impact
// project picker — so we load the full set rather than paginate. These ceilings
// exist purely so the query can never return an unbounded result set as the
// table grows; they're far above any realistic project count.
const PROJECTS_LIMIT = 2000;

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
       -- Migration-compatibility: early rows only have the legacy owner_user_id
       -- (singular). If the new owner_user_ids array is still empty we fall back
       -- to wrapping the legacy column so the rest of the codebase always sees
       -- a consistent array shape.
       COALESCE(
         NULLIF(p.owner_user_ids, '{}'),
         CASE WHEN p.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[p.owner_user_id] END
       ) AS owner_user_ids,
       p.sort_order,
       -- Force UTC suffix so JS Date parsing is unambiguous on all platforms.
       (p.created_at AT TIME ZONE 'UTC')::text || 'Z' as created_at,
       (p.updated_at AT TIME ZONE 'UTC')::text || 'Z' as updated_at
     FROM projects p
     -- Default sort: kanban column order first, then priority within each column,
     -- then the manual board order (sort_order), then newest-first. The board UI
     -- re-sorts client-side too, but this order is what server components and the
     -- overview page see.
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
       p.sort_order DESC,
       p.created_at DESC
     LIMIT ${PROJECTS_LIMIT}`
  );
  return res.rows as ProjectRow[];
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
       sort_order,
       updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       -- New cards land on top of their (status, priority) group.
       (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM projects WHERE status = $3 AND priority = $4),
       (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
     )
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

// Strips the time component that Postgres DATE columns can carry when cast to
// text (e.g. "2026-05-28T00:00:00.000Z" → "2026-05-28"). Without this,
// a round-tripped deadline would always look "changed" because the stored
// value and the form value differ in format even though the date is the same.
function normalizeDeadline(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  return trimmed.split("T")[0].split(" ")[0];
}

// Compares the old DB row with the incoming update and returns a label for
// what changed. The label is stored as last_update_type and drives the push
// notification message — "status changed" is more useful than a generic "updated".
// Priority order: status > deadline > priority > name > description > details.
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

// Persists manual board ordering for one or more cards in a single statement.
// Each entry maps a project id to its new sort_order. Used by drag-to-column
// (one card bumped to the top of its group) and the up/down reorder arrows
// (a whole priority group renumbered).
export async function reorderProjectsInDB(updates: { id: number; sortOrder: number }[]) {
  if (updates.length === 0) return;

  // Build a VALUES list: ($1::int, $2::int), ($3::int, $4::int), …
  const valueTuples = updates
    .map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::int)`)
    .join(", ");
  const params = updates.flatMap((update) => [update.id, update.sortOrder]);

  await pool.query(
    `UPDATE projects AS p
     SET sort_order = v.sort_order
     FROM (VALUES ${valueTuples}) AS v(id, sort_order)
     WHERE p.id = v.id`,
    params
  );
}
