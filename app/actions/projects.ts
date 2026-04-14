"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";

export interface ProjectRow {
  id: number;
  name: string;
  description: string;
  status: string;
  priority: string;
  deadline: string | null;
  team: string;
  tags: string[];
  owner_user_ids: number[];
  created_at: string;
  updated_at: string;
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

export async function getProjects() {
  try {
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
    return { success: true, projects: res.rows as ProjectRow[] };
  } catch (error) {
    console.error("Error fetching projects:", error);
    return { error: "Failed to fetch projects" };
  }
}

export async function createProject(data: {
  name: string;
  description: string;
  status: string;
  priority: string;
  deadline: string;
  team: string;
  tags: string[];
  ownerUserIds: number[];
}) {
  try {
    await assertCanEdit();
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
        Array.from(new Set(data.ownerUserIds)).filter((id) => Number.isInteger(id)),
      ]
    );
    const createdAt = res.rows[0].created_at;
    const updatedAt = res.rows[0].updated_at;

    return {
      success: true,
      id: res.rows[0].id as number,
      createdAt:
        createdAt instanceof Date
          ? createdAt.toISOString()
          : String(createdAt),
      updatedAt:
        updatedAt instanceof Date
          ? updatedAt.toISOString()
          : String(updatedAt),
    };
  } catch (error) {
    console.error("Error creating project:", error);
    return { error: "Failed to create project" };
  }
}

export async function updateProject(
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
  try {
    await assertCanEdit();
    const res = await pool.query(
      `UPDATE projects
       SET name=$1,
           description=$2,
           status=$3,
           priority=$4,
           deadline=$5,
           team=$6,
           tags=$7,
           owner_user_ids=$8,
           updated_at=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
       WHERE id=$9
       RETURNING (updated_at AT TIME ZONE 'UTC')::text || 'Z' as updated_at`,
      [
        data.name,
        data.description,
        data.status,
        data.priority,
        data.deadline || null,
        data.team,
        data.tags,
        Array.from(new Set(data.ownerUserIds)).filter((ownerId) => Number.isInteger(ownerId)),
        id,
      ]
    );
    const updatedAt = res.rows[0]?.updated_at;
    return {
      success: true,
      updatedAt:
        updatedAt instanceof Date
          ? updatedAt.toISOString()
          : typeof updatedAt === "string"
            ? updatedAt
            : undefined,
    };
  } catch (error) {
    console.error("Error updating project:", error);
    return { error: "Failed to update project" };
  }
}

export async function deleteProject(id: number) {
  try {
    await assertCanEdit();
    await pool.query("DELETE FROM projects WHERE id = $1", [id]);
    return { success: true };
  } catch (error) {
    console.error("Error deleting project:", error);
    return { error: "Failed to delete project" };
  }
}
