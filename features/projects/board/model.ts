import type { ProjectRow } from "@/types";
import { normalizeOwnerUserIds } from "@/lib/owner-users";

export type Priority = "low" | "medium" | "high";
export type Status = "planning" | "in_progress" | "review" | "completed";
export type ProjectPriorityFilter = Priority | "all";

export interface Project {
  id: number;
  name: string;
  description: string;
  status: Status;
  priority: Priority;
  deadline: string;
  team: string;
  tags: string[];
  ownerUserIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectReviewStatus {
  status: string;
  reviewId: number;
  feedback: string | null;
}

export const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "planning", label: "Planning", color: "border-t-slate-400" },
  { id: "in_progress", label: "In Progress", color: "border-t-blue-500" },
  { id: "review", label: "Review", color: "border-t-amber-500" },
  { id: "completed", label: "Completed", color: "border-t-green-500" },
];

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; classes: string; accent: string }
> = {
  high: {
    label: "High",
    classes: "bg-rose-100 text-rose-700 border-rose-200",
    accent: "bg-rose-400",
  },
  medium: {
    label: "Medium",
    classes: "bg-amber-100 text-amber-700 border-amber-200",
    accent: "bg-amber-400",
  },
  low: {
    label: "Low",
    classes: "bg-slate-100 text-slate-600 border-slate-200",
    accent: "bg-slate-400",
  },
};

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const PROJECT_SKELETON_STORAGE_KEY = "project-board-skeleton-counts";
export const EMPTY_COLUMN_COUNTS: Record<Status, number> = {
  planning: 0,
  in_progress: 0,
  review: 0,
  completed: 0,
};

export const EMPTY_PROJECT: Project = {
  id: 0,
  name: "",
  description: "",
  status: "planning",
  priority: "medium",
  deadline: "",
  team: "",
  tags: [],
  ownerUserIds: [],
  createdAt: "",
  updatedAt: "",
};

export function isStatus(value: string): value is Status {
  return COLUMNS.some((column) => column.id === value);
}

export function getProjectPayload(project: Project) {
  return {
    name: project.name.trim(),
    description: project.description,
    status: project.status,
    priority: project.priority,
    deadline: project.deadline,
    team: project.team,
    tags: project.tags,
    ownerUserIds: project.ownerUserIds,
  };
}

export function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as Status,
    priority: row.priority as Priority,
    deadline: row.deadline || "",
    team: row.team,
    tags: row.tags || [],
    ownerUserIds: normalizeOwnerUserIds(row.owner_user_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function sortProjectsByPriority(items: Project[]) {
  return [...items].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function filterProjects(
  items: Project[],
  filters: { search: string; priority: ProjectPriorityFilter }
) {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return items.filter((project) => {
    if (filters.priority !== "all" && project.priority !== filters.priority) {
      return false;
    }

    if (normalizedSearch && !project.name.toLowerCase().includes(normalizedSearch)) {
      return false;
    }

    return true;
  });
}

export function getDropPreviewIndex(
  items: Project[],
  draggedProject: Project | null,
  targetStatus: Status
) {
  if (!draggedProject || draggedProject.status === targetStatus) {
    return null;
  }

  const previewItems = sortProjectsByPriority([
    ...items,
    {
      ...draggedProject,
      status: targetStatus,
    },
  ]);

  return previewItems.findIndex((project) => project.id === draggedProject.id);
}
