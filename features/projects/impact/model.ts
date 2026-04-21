import type { ProjectRow } from "@/types";
import type { ImpactRecordRow } from "@/app/actions/impact";

export type ActivityType =
  | "workshop"
  | "training"
  | "outreach"
  | "mentoring"
  | "event"
  | "other";

export interface ImpactRecord {
  id: number;
  projectId: number | null;
  projectName: string;
  activityType: ActivityType;
  peopleReached: number;
  date: string;
  resultSummary: string;
  evidenceLink: string;
  createdAt: string;
}

export interface ProjectOption {
  id: number;
  name: string;
}

export const ACTIVITY_CONFIG: Record<
  ActivityType,
  { label: string; color: string }
> = {
  workshop: { label: "Workshop", color: "bg-purple-100 text-purple-700" },
  training: { label: "Training", color: "bg-blue-100 text-blue-700" },
  outreach: { label: "Outreach", color: "bg-blue-100 text-blue-700" },
  mentoring: { label: "Mentoring", color: "bg-amber-100 text-amber-700" },
  event: { label: "Event", color: "bg-rose-100 text-rose-700" },
  other: { label: "Other", color: "bg-slate-100 text-slate-600" },
};

export const EMPTY_IMPACT_RECORD: ImpactRecord = {
  id: 0,
  projectId: null,
  projectName: "",
  activityType: "other",
  peopleReached: 0,
  date: "",
  resultSummary: "",
  evidenceLink: "",
  createdAt: "",
};

export const IMPACT_RECORD_SKELETON_STORAGE_KEY = "impact-record-skeleton-count";
export const IMPACT_PROJECT_SKELETON_STORAGE_KEY = "impact-project-skeleton-count";

export function getImpactPayload(record: ImpactRecord): {
  projectId: number;
  activityType: ActivityType;
  peopleReached: number;
  date: string;
  resultSummary: string;
  evidenceLink: string;
} {
  if (!record.projectId) {
    throw new Error("Project ID is required");
  }

  return {
    projectId: record.projectId,
    activityType: record.activityType,
    peopleReached: record.peopleReached,
    date: record.date,
    resultSummary: record.resultSummary.trim(),
    evidenceLink: record.evidenceLink.trim(),
  };
}

export function rowToProjectOption(row: ProjectRow): ProjectOption {
  return {
    id: row.id,
    name: row.name,
  };
}

export function rowToRecord(row: ImpactRecordRow): ImpactRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    activityType: row.activity_type as ActivityType,
    peopleReached: row.people_reached,
    date: row.date,
    resultSummary: row.result_summary || "",
    evidenceLink: row.evidence_link || "",
    createdAt: row.created_at,
  };
}

export function buildProjectTotals(items: ImpactRecord[]) {
  const map: Record<string, number> = {};

  items.forEach((record) => {
    map[record.projectName] = (map[record.projectName] || 0) + record.peopleReached;
  });

  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export function getEvidenceHref(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}

export function sortRecords(items: ImpactRecord[]) {
  return [...items].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
