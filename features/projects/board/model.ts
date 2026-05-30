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
  // Manual board order within a (status, priority) group. Higher sits on top.
  // 0 means "never reordered" → falls back to newest-first ordering.
  sortOrder: number;
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
  sortOrder: 0,
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
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function sortProjectsByPriority(items: Project[]) {
  return [...items].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Within a priority group, honor the manual board order first (higher
    // sort_order sits on top). A freshly dragged-in card is bumped above its
    // group, and the up/down arrows swap neighbors here. Cards that were never
    // reordered (sort_order 0) fall back to newest-first.
    if (b.sortOrder !== a.sortOrder) return b.sortOrder - a.sortOrder;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// Cards in the same column + priority form an ordered group. A dragged-in or
// freshly created card lands on top of its group, which means a sort_order one
// above the current group maximum.
export function topSortOrderForGroup(
  allProjects: Project[],
  status: Status,
  priority: Priority,
  excludeId?: number
) {
  const max = allProjects.reduce((highest, project) => {
    if (
      project.id === excludeId ||
      project.status !== status ||
      project.priority !== priority
    ) {
      return highest;
    }
    return Math.max(highest, project.sortOrder);
  }, 0);

  return max + 1;
}

// Computes the sort_order updates needed to nudge one card up (dir -1) or down
// (dir +1) by a single slot within its (status, priority) group. The whole group
// is renumbered to a clean strictly-descending sequence so the new order is
// unambiguous even when its members were previously all at the default 0.
export function reorderWithinPriorityGroup(
  allProjects: Project[],
  projectId: number,
  dir: -1 | 1
): { id: number; sortOrder: number }[] {
  const target = allProjects.find((project) => project.id === projectId);
  if (!target) return [];

  const group = sortProjectsByPriority(
    allProjects.filter(
      (project) =>
        project.status === target.status && project.priority === target.priority
    )
  );

  const index = group.findIndex((project) => project.id === projectId);
  const swapWith = index + dir;
  if (index < 0 || swapWith < 0 || swapWith >= group.length) {
    return [];
  }

  const reordered = [...group];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];

  // First item gets the highest value; every value is >= 1 so the group stays
  // above any default-0 sibling that isn't part of this set.
  const base = reordered.length;
  return reordered.map((project, i) => ({ id: project.id, sortOrder: base - i }));
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

  // The dragged card always lands at the top of its priority group: above every
  // card that shares its priority, and below cards of higher priority. `items`
  // is already sorted, so the insertion index is the number of higher-priority
  // cards already in the column.
  const draggedOrder = PRIORITY_ORDER[draggedProject.priority];
  return items.filter(
    (project) => PRIORITY_ORDER[project.priority] < draggedOrder
  ).length;
}
