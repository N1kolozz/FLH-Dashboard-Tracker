"use server";

import { after } from "next/server";
import { getSession } from "@/lib/auth";
import { assertSameOrigin, requireAuthenticatedSession } from "@/lib/action-auth";
import {
  assertCanManageProjects,
  getSessionUserId,
} from "@/lib/permissions";
import { createPushNotification, notifySubscribers } from "@/lib/push";
import {
  fetchAllProjects,
  insertProject,
  updateProjectInDB,
  deleteProjectFromDB,
  reorderProjectsInDB,
} from "@/lib/dal/projects";
import { logActivity } from "@/lib/activity";
import { log } from "@/lib/logger";

export async function getProjects() {
  try {
    await requireAuthenticatedSession();
    const projects = await fetchAllProjects();
    return { success: true, projects };
  } catch (error) {
    log.error("Error fetching projects", error);
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
    await assertSameOrigin();
    const session = await getSession();
    assertCanManageProjects(session);
    const actorUserId = getSessionUserId(session);
    const row = await insertProject(data);
    const createdAt = row.created_at;
    const updatedAt = row.updated_at;

    after(async () => {
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
        log.error("Error sending project push notification", pushError);
      }
    });

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
    log.error("Error creating project", error);
    return { error: "Failed to create project" };
  }
}

const STATUS_LABELS: Record<string, string> = {
  planning: "დაგეგმვა",
  in_progress: "მიმდინარეობს",
  review: "განხილვა",
  completed: "დასრულდა",
  rejected: "უარყოფილია",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "მაღალი",
  medium: "საშუალო",
  low: "დაბალი",
};

function translateStatus(s: string) {
  return STATUS_LABELS[s] ?? s.replace(/_/g, " ");
}

function translatePriority(p: string) {
  return PRIORITY_LABELS[p] ?? p;
}

function buildUpdateNotificationBody(
  updateType: string,
  oldRow: { name: string; status: string; priority: string; deadline: string | null } | null | undefined,
  data: { name: string; status: string; priority: string; deadline: string }
): string {
  if (!oldRow) return "პროექტის დეტალები განახლდა.";

  switch (updateType) {
    case "status":
      return `სტატუსი: ${translateStatus(oldRow.status)} → ${translateStatus(data.status)}`;
    case "priority":
      return `პრიორიტეტი: ${translatePriority(oldRow.priority)} → ${translatePriority(data.priority)}`;
    case "name":
      return `სახელი: "${oldRow.name}" → "${data.name}"`;
    case "deadline": {
      const oldD = oldRow.deadline ? String(oldRow.deadline).split("T")[0] : "—";
      const newD = data.deadline ? data.deadline.split("T")[0] : "—";
      return `დედლაინი: ${oldD} → ${newD}`;
    }
    case "description":
      return "აღწერა განახლდა.";
    default:
      return "პროექტის დეტალები განახლდა.";
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
    await assertSameOrigin();
    const session = await getSession();
    assertCanManageProjects(session);
    const actorUserId = getSessionUserId(session);
    const row = await updateProjectInDB(id, data);
    const updatedAt = row?.updated_at;

    after(async () => {
      try {
        const updateType = row?.last_update_type ?? "details";
        const oldRow = row?.oldRow;
        const notifBody = buildUpdateNotificationBody(updateType, oldRow, data);

        await notifySubscribers({
          topic: "projects",
          excludeUserId: actorUserId,
          payload: createPushNotification({
            topic: "projects",
            title: `პროექტი განახლდა: ${data.name}`,
            body: notifBody,
            url: "/projects/overview",
            tag: `project-${id}`,
          }),
        });
      } catch (pushError) {
        log.error("Error sending project update notification", pushError);
      }
    });

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
    log.error("Error updating project", error);
    return { error: "Failed to update project" };
  }
}

/* Persist manual board ordering (up/down arrows, drag-to-top placement). */
export async function reorderProjects(
  updates: { id: number; sortOrder: number }[]
) {
  try {
    await assertSameOrigin();
    const session = await getSession();
    assertCanManageProjects(session);

    const sanitized = updates
      .filter(
        (update) =>
          Number.isInteger(update.id) && Number.isFinite(update.sortOrder)
      )
      .map((update) => ({
        id: update.id,
        sortOrder: Math.trunc(update.sortOrder),
      }));

    if (sanitized.length === 0) {
      return { success: true };
    }

    await reorderProjectsInDB(sanitized);
    return { success: true };
  } catch (error) {
    log.error("Error reordering projects", error);
    return { error: "Failed to reorder projects" };
  }
}

export async function deleteProject(id: number) {
  try {
    await assertSameOrigin();
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
    log.error("Error deleting project", error);
    return { error: "Failed to delete project" };
  }
}
