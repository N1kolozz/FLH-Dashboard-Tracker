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

export async function getProjects() {
  try {
    const res = await pool.query(
      "SELECT id, name, description, status, priority, deadline::text, team, tags, created_at FROM projects ORDER BY created_at DESC"
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
}) {
  try {
    await assertCanEdit();
    const res = await pool.query(
      `INSERT INTO projects (name, description, status, priority, deadline, team, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        data.name,
        data.description,
        data.status,
        data.priority,
        data.deadline || null,
        data.team,
        data.tags,
      ]
    );
    return { success: true, id: res.rows[0].id };
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
  }
) {
  try {
    await assertCanEdit();
    await pool.query(
      `UPDATE projects SET name=$1, description=$2, status=$3, priority=$4, deadline=$5, team=$6, tags=$7 WHERE id=$8`,
      [
        data.name,
        data.description,
        data.status,
        data.priority,
        data.deadline || null,
        data.team,
        data.tags,
        id,
      ]
    );
    return { success: true };
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
