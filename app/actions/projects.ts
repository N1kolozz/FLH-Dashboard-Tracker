"use server";

import { getSession } from "@/lib/auth";
import { requireAuthenticatedSession } from "@/lib/action-auth";
import {
  assertCanManageProjects,
  getSessionUserId,
} from "@/lib/permissions";
import { createPushNotification, notifySubscribers } from "@/lib/push";
import {
  fetchAllProjects,
  fetchRejectedProjects,
  insertProject,
  updateProjectInDB,
  deleteProjectFromDB,
} from "@/lib/dal/projects";
import { logActivity } from "@/lib/activity";

export async function getProjects() {
  try {
    await requireAuthenticatedSession();
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
    await requireAuthenticatedSession();
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
    const actorUserId = getSessionUserId(session);
    const row = await insertProject(data);
    const createdAt = row.created_at;
    const updatedAt = row.updated_at;

    try {
      await notifySubscribers({
        topic: "projects",
        excludeUserId: actorUserId,
        payload: createPushNotification({
          topic: "projects",
          title: `ახალი პროექტი: ${data.name}`,
          body: data.deadline
            ? `დედლაინი: ${data.deadline}.`
            : "dashboard-ში ახალი პროექტი დაემატა.",
          url: "/projects/overview",
          tag: `project-${row.id as number}`,
        }),
      });
    } catch (pushError) {
      console.error("Error sending project push notification:", pushError);
    }

    await logActivity(
      "create_project",
      "/projects",
      { projectId: row.id, projectName: data.name },
      actorUserId || undefined
    );

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
    const actorUserId = getSessionUserId(session);
    const row = await updateProjectInDB(id, data);
    const updatedAt = row?.updated_at;

    try {
      await notifySubscribers({
        topic: "projects",
        excludeUserId: actorUserId,
        payload: createPushNotification({
          topic: "projects",
          title: `პროექტი განახლდა: ${data.name}`,
          body: data.status
            ? `სტატუსი: ${data.status.replace(/_/g, " ")}.`
            : "dashboard-ში პროექტი განახლდა.",
          url: "/projects/overview",
          tag: `project-${id}`,
        }),
      });
    } catch (pushError) {
      console.error("Error sending project update notification:", pushError);
    }

    await logActivity(
      "update_project",
      "/projects",
      { projectId: id, projectName: data.name },
      actorUserId || undefined
    );

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
    const actorUserId = getSessionUserId(session);
    await logActivity(
      "delete_project",
      "/projects",
      { projectId: id },
      actorUserId || undefined
    );
    return { success: true };
  } catch (error) {
    console.error("Error deleting project:", error);
    return { error: "Failed to delete project" };
  }
}
