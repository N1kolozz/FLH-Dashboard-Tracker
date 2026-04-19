"use server";

import { getSession } from "@/lib/auth";
import { assertCanManageProjects } from "@/lib/permissions";
import {
  fetchAllProjects,
  fetchRejectedProjects,
  insertProject,
  updateProjectInDB,
  deleteProjectFromDB,
} from "@/lib/dal/projects";

export async function getProjects() {
  try {
    const projects = await fetchAllProjects();
    return { success: true, projects };
  } catch (error) {
    console.error("Error fetching projects:", error);
    return { error: "Failed to fetch projects" };
  }
}

/* Get rejected projects for portfolio page */
export async function getRejectedProjects() {
  try {
    const projects = await fetchRejectedProjects();
    return { success: true, projects };
  } catch (error) {
    console.error("Error fetching rejected projects:", error);
    return { error: "Failed to fetch rejected projects" };
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
    const session = await getSession();
    assertCanManageProjects(session);
    const row = await insertProject(data);
    const createdAt = row.created_at;
    const updatedAt = row.updated_at;

    return {
      success: true,
      id: row.id as number,
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
    const session = await getSession();
    assertCanManageProjects(session);
    const row = await updateProjectInDB(id, data);
    const updatedAt = row?.updated_at;
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
    const session = await getSession();
    assertCanManageProjects(session);
    await deleteProjectFromDB(id);
    return { success: true };
  } catch (error) {
    console.error("Error deleting project:", error);
    return { error: "Failed to delete project" };
  }
}
