import type { ProjectRow } from "@/types";
import type { ImpactRecordRow } from "@/app/actions/impact";
import { normalizeOwnerUserIds } from "@/lib/owner-users";

export type Priority = "low" | "medium" | "high";
export type Status =
  | "planning"
  | "in_progress"
  | "review"
  | "completed"
  | "rejected";
export type ActivityType =
  | "workshop"
  | "training"
  | "outreach"
  | "mentoring"
  | "event"
  | "other";
export type AttentionTone = "rose" | "amber" | "blue" | "slate";

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

export interface OutcomeRecord {
  id: number;
  projectId: number | null;
  projectName: string;
  activityType: ActivityType;
  peopleReached: number;
  date: string;
  createdAt: string;
}

export interface MemberSummary {
  id: number;
  name: string;
}

export interface OutcomeSummary {
  peopleReached: number;
  activities: number;
  lastActivityDate: string | null;
}

export interface AttentionItem {
  label: string;
  tone: AttentionTone;
  weight: number;
}

export interface EnrichedProject extends Project {
  ownerNames: string[];
  daysUntilDeadline: number | null;
  attentionItems: AttentionItem[];
  attentionScore: number;
  outcomeSummary: OutcomeSummary;
}

export const STATUS_CONFIG: Record<Status, { label: string; classes: string }> = {
  planning: {
    label: "Planning",
    classes: "bg-slate-100 text-slate-700 border-slate-200",
  },
  in_progress: {
    label: "In Progress",
    classes: "bg-blue-100 text-blue-700 border-blue-200",
  },
  review: {
    label: "Review",
    classes: "bg-amber-100 text-amber-700 border-amber-200",
  },
  completed: {
    label: "Completed",
    classes: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "Rejected",
    classes: "bg-rose-100 text-rose-700 border-rose-200",
  },
};

export const PRIORITY_CONFIG: Record<Priority, { label: string; classes: string }> = {
  high: {
    label: "High",
    classes: "bg-rose-100 text-rose-700 border-rose-200",
  },
  medium: {
    label: "Medium",
    classes: "bg-amber-100 text-amber-700 border-amber-200",
  },
  low: {
    label: "Low",
    classes: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

export const ATTENTION_BADGE_CLASSES: Record<AttentionTone, string> = {
  rose: "bg-rose-100 text-rose-700 border-rose-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

export const ATTENTION_CARD_CLASSES: Record<
  AttentionTone,
  { card: string; accent: string; metric: string }
> = {
  rose: {
    card: "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white",
    accent: "bg-rose-500",
    metric: "border-rose-100 bg-white/80",
  },
  amber: {
    card: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white",
    accent: "bg-amber-500",
    metric: "border-amber-100 bg-white/80",
  },
  blue: {
    card: "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white",
    accent: "bg-blue-500",
    metric: "border-blue-100 bg-white/80",
  },
  slate: {
    card: "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white",
    accent: "bg-slate-400",
    metric: "border-slate-200 bg-white/80",
  },
};

export const EMPTY_OUTCOME_SUMMARY: OutcomeSummary = {
  peopleReached: 0,
  activities: 0,
  lastActivityDate: null,
};

const MS_PER_DAY = 86_400_000;

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

export function rowToOutcome(row: ImpactRecordRow): OutcomeRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    activityType: row.activity_type as ActivityType,
    peopleReached: row.people_reached,
    date: row.date,
    createdAt: row.created_at,
  };
}

export function normalizeProjectName(name: string) {
  return name.trim().toLowerCase();
}

export function mergeOutcomeSummary(
  first: OutcomeSummary = EMPTY_OUTCOME_SUMMARY,
  second: OutcomeSummary = EMPTY_OUTCOME_SUMMARY
): OutcomeSummary {
  return {
    peopleReached: first.peopleReached + second.peopleReached,
    activities: first.activities + second.activities,
    lastActivityDate:
      !first.lastActivityDate
        ? second.lastActivityDate
        : !second.lastActivityDate
          ? first.lastActivityDate
          : first.lastActivityDate > second.lastActivityDate
            ? first.lastActivityDate
            : second.lastActivityDate,
  };
}

export function getDaysUntilDeadline(deadline: string) {
  if (!deadline) return null;

  const deadlineDate = new Date(`${deadline}T00:00:00`);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((deadlineDate.getTime() - todayStart.getTime()) / MS_PER_DAY);
}

export function formatDate(value: string | null) {
  if (!value) return "No activity yet";

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string) {
  if (!value) return "Not updated yet";

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeUpdate(value: string) {
  if (!value) return "Not updated yet";

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(Math.round(diffMs / 60000), 0);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDateTime(value);
}

export function formatDeadlineLabel(project: EnrichedProject) {
  if (!project.deadline) return "No deadline";
  if (project.status === "completed") return `Closed on ${formatDate(project.deadline)}`;
  if (project.daysUntilDeadline === null) return formatDate(project.deadline);
  if (project.daysUntilDeadline < 0) return `${Math.abs(project.daysUntilDeadline)}d overdue`;
  if (project.daysUntilDeadline === 0) return "Due today";
  if (project.daysUntilDeadline <= 7) return `Due in ${project.daysUntilDeadline}d`;
  return `${project.daysUntilDeadline}d left`;
}

export function getAttentionItems(
  project: Project,
  daysUntilDeadline: number | null,
  outcomeSummary: OutcomeSummary
) {
  const items: AttentionItem[] = [];

  if (project.status === "rejected") return items;

  if (project.status !== "completed" && daysUntilDeadline !== null && daysUntilDeadline < 0) {
    items.push({
      label: `Overdue by ${Math.abs(daysUntilDeadline)}d`,
      tone: "rose",
      weight: 4,
    });
  }

  if (
    project.status !== "completed" &&
    daysUntilDeadline !== null &&
    daysUntilDeadline >= 0 &&
    daysUntilDeadline <= 7
  ) {
    items.push({
      label: daysUntilDeadline === 0 ? "Due today" : `Due in ${daysUntilDeadline}d`,
      tone: "amber",
      weight: 3,
    });
  }

  if (project.status !== "completed" && project.ownerUserIds.length === 0) {
    items.push({
      label: "No owner assigned",
      tone: "amber",
      weight: 3,
    });
  }

  if (project.priority === "high" && project.status === "planning") {
    items.push({
      label: "High priority not started",
      tone: "blue",
      weight: 2,
    });
  }

  if (project.status === "completed" && outcomeSummary.activities === 0) {
    items.push({
      label: "Completed without outcomes",
      tone: "slate",
      weight: 1,
    });
  }

  return items;
}

export function compareProjects(a: EnrichedProject, b: EnrichedProject) {
  if (b.attentionScore !== a.attentionScore) {
    return b.attentionScore - a.attentionScore;
  }

  const aDeadline = a.daysUntilDeadline ?? Number.POSITIVE_INFINITY;
  const bDeadline = b.daysUntilDeadline ?? Number.POSITIVE_INFINITY;

  if (aDeadline !== bDeadline) {
    return aDeadline - bDeadline;
  }

  return a.name.localeCompare(b.name);
}

export function getPrimaryAttentionTone(items: AttentionItem[]): AttentionTone {
  return items.reduce<AttentionTone>((current, item) => {
    const currentWeight = items.find((entry) => entry.tone === current)?.weight ?? -1;
    return item.weight > currentWeight ? item.tone : current;
  }, items[0]?.tone ?? "slate");
}

export function formatOwnerSummary(ownerNames: string[]) {
  if (ownerNames.length === 0) return "Unassigned";
  if (ownerNames.length <= 2) return ownerNames.join(", ");
  return `${ownerNames.slice(0, 2).join(", ")} +${ownerNames.length - 2}`;
}

export function getAttentionDescription(project: EnrichedProject) {
  if (project.description.trim()) {
    return project.description.trim();
  }

  if (project.status === "review") {
    return "Waiting on review feedback or a final approval step.";
  }

  if (project.status === "planning") {
    return "Needs an owner or a kickoff push to move out of planning.";
  }

  if (project.status === "completed") {
    return "Completed project that still needs outcomes or a final wrap-up check.";
  }

  return "Needs follow-up to keep delivery and reporting on track.";
}

export function getPortfolioAttentionLabel(label: string) {
  if (label === "High priority not started") return "Start pending";
  if (label === "Completed without outcomes") return "Needs outcomes";
  if (label === "No owner assigned") return "No owner";
  return label;
}
