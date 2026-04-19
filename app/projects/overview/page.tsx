"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getProjects } from "@/app/actions/projects";
import type { ProjectRow } from "@/types";
import { getImpactRecords } from "@/app/actions/impact";
import type { ImpactRecordRow } from "@/app/actions/impact";
import { getMembers } from "@/app/actions/members";
import EmptyState from "@/components/EmptyState";
import ProjectsSubnav from "@/components/ProjectsSubnav";
import { getProjectReviewStatuses } from "@/app/actions/reviews";

type Priority = "low" | "medium" | "high";
type Status = "planning" | "in_progress" | "review" | "completed" | "rejected";
type ActivityType = "workshop" | "training" | "outreach" | "mentoring" | "event" | "other";
type AttentionTone = "rose" | "amber" | "blue" | "slate";

interface Project {
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

interface OutcomeRecord {
  id: number;
  projectId: number | null;
  projectName: string;
  activityType: ActivityType;
  peopleReached: number;
  date: string;
  createdAt: string;
}

interface MemberSummary {
  id: number;
  name: string;
}

interface OutcomeSummary {
  peopleReached: number;
  activities: number;
  lastActivityDate: string | null;
}

interface AttentionItem {
  label: string;
  tone: AttentionTone;
  weight: number;
}

interface EnrichedProject extends Project {
  ownerNames: string[];
  daysUntilDeadline: number | null;
  attentionItems: AttentionItem[];
  attentionScore: number;
  outcomeSummary: OutcomeSummary;
}

const STATUS_CONFIG: Record<Status, { label: string; classes: string }> = {
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

const PRIORITY_CONFIG: Record<Priority, { label: string; classes: string }> = {
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

const ATTENTION_BADGE_CLASSES: Record<AttentionTone, string> = {
  rose: "bg-rose-100 text-rose-700 border-rose-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

const ATTENTION_CARD_CLASSES: Record<
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

const EMPTY_OUTCOME_SUMMARY: OutcomeSummary = {
  peopleReached: 0,
  activities: 0,
  lastActivityDate: null,
};

const MS_PER_DAY = 86_400_000;

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as Status,
    priority: row.priority as Priority,
    deadline: row.deadline || "",
    team: row.team,
    tags: row.tags || [],
    ownerUserIds: (row.owner_user_ids || []).map(Number),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToOutcome(row: ImpactRecordRow): OutcomeRecord {
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

function normalizeProjectName(name: string) {
  return name.trim().toLowerCase();
}

function mergeOutcomeSummary(
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

function getDaysUntilDeadline(deadline: string) {
  if (!deadline) return null;

  const deadlineDate = new Date(`${deadline}T00:00:00`);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((deadlineDate.getTime() - todayStart.getTime()) / MS_PER_DAY);
}

function formatDate(value: string | null) {
  if (!value) return "No activity yet";

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  if (!value) return "Not updated yet";

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeUpdate(value: string) {
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

function formatDeadlineLabel(project: EnrichedProject) {
  if (!project.deadline) return "No deadline";
  if (project.status === "completed") return `Closed on ${formatDate(project.deadline)}`;
  if (project.daysUntilDeadline === null) return formatDate(project.deadline);
  if (project.daysUntilDeadline < 0) return `${Math.abs(project.daysUntilDeadline)}d overdue`;
  if (project.daysUntilDeadline === 0) return "Due today";
  if (project.daysUntilDeadline <= 7) return `Due in ${project.daysUntilDeadline}d`;
  return `${project.daysUntilDeadline}d left`;
}

function getAttentionItems(project: Project, daysUntilDeadline: number | null, outcomeSummary: OutcomeSummary) {
  const items: AttentionItem[] = [];

  // Rejected projects don't need attention flags
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

function compareProjects(a: EnrichedProject, b: EnrichedProject) {
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

function getPrimaryAttentionTone(items: AttentionItem[]): AttentionTone {
  return items.reduce<AttentionTone>((current, item) => {
    const currentWeight = items.find((entry) => entry.tone === current)?.weight ?? -1;
    return item.weight > currentWeight ? item.tone : current;
  }, items[0]?.tone ?? "slate");
}

function formatOwnerSummary(ownerNames: string[]) {
  if (ownerNames.length === 0) return "Unassigned";
  if (ownerNames.length <= 2) return ownerNames.join(", ");
  return `${ownerNames.slice(0, 2).join(", ")} +${ownerNames.length - 2}`;
}

function getAttentionDescription(project: EnrichedProject) {
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

function getPortfolioAttentionLabel(label: string) {
  if (label === "High priority not started") return "Start pending";
  if (label === "Completed without outcomes") return "Needs outcomes";
  if (label === "No owner assigned") return "No owner";
  return label;
}

function PortfolioBadge({
  label,
  className,
  title,
}: {
  label: string;
  className: string;
  title?: string;
}) {
  return (
    <span
      title={title ?? label}
      className={`inline-flex min-h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-4 sm:px-3 ${className}`}
    >
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </div>
  );
}

function OverviewStatSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-8 w-20 rounded-full bg-slate-200" />
      <div className="mt-3 h-3 w-28 rounded-full bg-slate-100" />
      <div className="mt-3 h-3 w-36 rounded-full bg-slate-100" />
    </div>
  );
}

function OverviewPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 h-4 w-36 animate-pulse rounded-full bg-slate-200" />
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="animate-pulse border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
            <div className="h-4 w-40 rounded-full bg-slate-200" />
            <div className="mt-2 h-3 w-56 rounded-full bg-slate-100" />
            <div className="mt-3 flex gap-2">
              <div className="h-6 w-24 rounded-full bg-slate-100" />
              <div className="h-6 w-20 rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewTableSkeleton() {
  return (
    <div className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Owners</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Deadline</th>
            <th className="px-4 py-3">Last Update</th>
            <th className="px-4 py-3">Outcomes</th>
            <th className="px-4 py-3">Attention</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, idx) => (
            <tr key={idx} className="animate-pulse">
              <td className="px-4 py-4">
                <div className="h-4 w-32 rounded-full bg-slate-200" />
                <div className="mt-2 h-3 w-44 rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-4"><div className="h-4 w-28 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-4"><div className="h-6 w-24 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-4"><div className="h-4 w-24 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-4"><div className="h-4 w-28 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-4"><div className="h-4 w-28 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-4"><div className="h-6 w-32 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-4"><div className="ml-auto h-8 w-24 rounded-lg bg-slate-100" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ProjectsOverviewPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [rejectionFeedbacks, setRejectionFeedbacks] = useState<
    Record<number, { feedback: string | null; reviewerName: string | null; rejectedAt: string | null }>
  >({});

  useEffect(() => {
    async function loadOverview() {
      setIsLoadingData(true);

      try {
        const [projectRes, outcomeRes, memberRes] = await Promise.all([
          getProjects(),
          getImpactRecords(),
          getMembers(),
        ]);

        if (projectRes.success && projectRes.projects) {
          setProjects(projectRes.projects.map(rowToProject));

          // Fetch rejection feedbacks for rejected projects
          const rejectedIds = projectRes.projects
            .filter((p) => p.status === "rejected")
            .map((p) => p.id);
          if (rejectedIds.length > 0) {
            const revStatuses = await getProjectReviewStatuses();
            const feedbacks: Record<number, { feedback: string | null; reviewerName: string | null; rejectedAt: string | null }> = {};
            for (const id of rejectedIds) {
              const rs = revStatuses[id];
              if (rs) {
                feedbacks[id] = { feedback: rs.feedback, reviewerName: null, rejectedAt: null };
              }
            }
            setRejectionFeedbacks(feedbacks);
          }
        }

        if (outcomeRes.success && outcomeRes.records) {
          setOutcomes(outcomeRes.records.map(rowToOutcome));
        }

        if (memberRes.success && memberRes.members) {
          const nextMembers = (memberRes.members as Array<{ id: number; name: string }>)
            .map((member) => ({ id: member.id, name: member.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setMembers(nextMembers);
        }
      } finally {
        setIsLoadingData(false);
      }
    }

    void loadOverview();
  }, []);

  const outcomeSummaries = useMemo(() => {
    const byProjectId = new Map<number, OutcomeSummary>();
    const byLegacyName = new Map<string, OutcomeSummary>();

    outcomes.forEach((record) => {
      const currentSummary = record.projectId
        ? byProjectId.get(record.projectId) ?? { ...EMPTY_OUTCOME_SUMMARY }
        : byLegacyName.get(normalizeProjectName(record.projectName)) ?? { ...EMPTY_OUTCOME_SUMMARY };

      const nextSummary = {
        peopleReached: currentSummary.peopleReached + record.peopleReached,
        activities: currentSummary.activities + 1,
        lastActivityDate:
          !currentSummary.lastActivityDate || record.date > currentSummary.lastActivityDate
            ? record.date
            : currentSummary.lastActivityDate,
      };

      if (record.projectId) {
        byProjectId.set(record.projectId, nextSummary);
      } else {
        byLegacyName.set(normalizeProjectName(record.projectName), nextSummary);
      }
    });

    return { byProjectId, byLegacyName };
  }, [outcomes]);

  const enrichedProjects = useMemo(() => {
    return projects
      .map<EnrichedProject>((project) => {
        const ownerNames = members
          .filter((member) => project.ownerUserIds.includes(member.id))
          .map((member) => member.name);
        const linkedOutcomeSummary =
          outcomeSummaries.byProjectId.get(project.id) ?? EMPTY_OUTCOME_SUMMARY;
        const legacyOutcomeSummary =
          outcomeSummaries.byLegacyName.get(normalizeProjectName(project.name)) ?? EMPTY_OUTCOME_SUMMARY;
        const outcomeSummary = mergeOutcomeSummary(linkedOutcomeSummary, legacyOutcomeSummary);
        const daysUntilDeadline = getDaysUntilDeadline(project.deadline);
        const attentionItems = getAttentionItems(project, daysUntilDeadline, outcomeSummary);

        return {
          ...project,
          ownerNames,
          daysUntilDeadline,
          attentionItems,
          attentionScore: attentionItems.reduce((sum, item) => sum + item.weight, 0),
          outcomeSummary,
        };
      })
      .sort(compareProjects);
  }, [members, outcomeSummaries, projects]);

  const filteredProjects = useMemo(() => {
    return enrichedProjects.filter((project) => {
      if (statusFilter !== "all" && project.status !== statusFilter) return false;
      if (priorityFilter !== "all" && project.priority !== priorityFilter) return false;

      if (!search) return true;

      const query = search.toLowerCase();
      return (
        project.name.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        project.team.toLowerCase().includes(query) ||
        project.ownerNames.some((name) => name.toLowerCase().includes(query))
      );
    });
  }, [enrichedProjects, priorityFilter, search, statusFilter]);

  const totalPeopleReached = outcomes.reduce((sum, record) => sum + record.peopleReached, 0);
  const projectsWithOutcomes = enrichedProjects.filter(
    (project) => project.outcomeSummary.activities > 0
  ).length;
  const inProgressCount = enrichedProjects.filter((project) => project.status === "in_progress").length;
  const overdueCount = enrichedProjects.filter(
    (project) =>
      project.status !== "completed" &&
      project.status !== "rejected" &&
      project.daysUntilDeadline !== null &&
      project.daysUntilDeadline < 0
  ).length;
  const dueSoonCount = enrichedProjects.filter(
    (project) =>
      project.status !== "completed" &&
      project.status !== "rejected" &&
      project.daysUntilDeadline !== null &&
      project.daysUntilDeadline >= 0 &&
      project.daysUntilDeadline <= 7
  ).length;
  const attentionProjects = enrichedProjects
    .filter((project) => project.attentionItems.length > 0 && project.status !== "rejected")
    .slice(0, 5);
  const legacyOutcomeCount = outcomes.filter((record) => record.projectId === null).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-purple-200/70 bg-blue-100/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                Projects Overview
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6z" />
                </svg>
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {isLoadingData
                  ? "Loading portfolio health and outcome data..."
                  : `${projects.length} project${projects.length !== 1 ? "s" : ""} with deadlines, owners, and results in one view`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/projects"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Open Board
              </Link>
              <Link
                href="/projects/impact"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                View Outcomes
              </Link>
            </div>
          </div>

          <ProjectsSubnav className="mt-4" />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
        {!isLoadingData && legacyOutcomeCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            {legacyOutcomeCount} outcome record{legacyOutcomeCount !== 1 ? "s still use" : " still uses"} the
            old text-only project name. The overview already prefers real project links and will get cleaner as
            those legacy records are relinked from Project Outcomes.
          </div>
        )}

        {isLoadingData ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <OverviewStatSkeleton key={idx} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              label="Total Projects"
              value={projects.length.toString()}
              hint={`${projectsWithOutcomes} project${projectsWithOutcomes !== 1 ? "s" : ""} already have logged outcomes`}
              color="text-slate-900"
            />
            <SummaryCard
              label="In Progress"
              value={inProgressCount.toString()}
              hint="Projects actively moving through delivery right now"
              color="text-blue-600"
            />
            <SummaryCard
              label="Due This Week"
              value={dueSoonCount.toString()}
              hint="Projects that need attention within the next 7 days"
              color="text-amber-600"
            />
            <SummaryCard
              label="Overdue"
              value={overdueCount.toString()}
              hint="Projects with passed deadlines that are not completed"
              color="text-rose-600"
            />
            <SummaryCard
              label="People Reached"
              value={totalPeopleReached.toLocaleString()}
              hint={`${outcomes.length} logged outcome activit${outcomes.length === 1 ? "y" : "ies"} across projects`}
              color="text-emerald-600"
            />
          </div>
        )}

        {isLoadingData ? (
          <OverviewPanelSkeleton rows={3} />
        ) : (
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/50 p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M12 9v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 3c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                        Needs Attention
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        The projects that need a decision, owner follow-up, or deadline focus next.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
                    {attentionProjects.length} flagged
                  </span>
                  <Link
                    href="/projects"
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Open board
                  </Link>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {attentionProjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/70 p-5 text-sm text-emerald-800">
                  Everything looks calm right now. No projects are currently flagged by the overview rules.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  {attentionProjects.map((project) => {
                    const primaryTone = getPrimaryAttentionTone(project.attentionItems);
                    const cardStyles = ATTENTION_CARD_CLASSES[primaryTone];

                    return (
                      <article
                        key={project.id}
                        className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 shadow-sm ${cardStyles.card}`}
                      >
                        <div className={`absolute inset-x-0 top-0 h-1.5 ${cardStyles.accent}`} />

                        <div className="min-w-0">
                          <h3 className="line-clamp-2 break-words text-xl font-semibold leading-tight text-slate-900">
                            {project.name}
                          </h3>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                            {getAttentionDescription(project)}
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PRIORITY_CONFIG[project.priority].classes}`}
                          >
                            {PRIORITY_CONFIG[project.priority].label} Priority
                          </span>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_CONFIG[project.status].classes}`}
                          >
                            {STATUS_CONFIG[project.status].label}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className={`rounded-2xl border p-3 ${cardStyles.metric}`}>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Owner
                            </p>
                            <p className="mt-1 break-words text-sm font-medium leading-6 text-slate-800">
                              {formatOwnerSummary(project.ownerNames)}
                            </p>
                          </div>
                          <div className={`rounded-2xl border p-3 ${cardStyles.metric}`}>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Deadline
                            </p>
                            <p className="mt-1 text-sm font-medium leading-6 text-slate-800">
                              {formatDeadlineLabel(project)}
                            </p>
                          </div>
                          <div className={`rounded-2xl border p-3 ${cardStyles.metric}`}>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Last Update
                            </p>
                            <p className="mt-1 text-sm font-medium leading-6 text-slate-800">
                              {formatRelativeUpdate(project.updatedAt)}
                            </p>
                          </div>
                          <div className={`rounded-2xl border p-3 ${cardStyles.metric}`}>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Outcomes
                            </p>
                            <p className="mt-1 text-sm font-medium leading-6 text-slate-800">
                              {project.outcomeSummary.activities} activit
                              {project.outcomeSummary.activities === 1 ? "y" : "ies"}
                            </p>
                            <p className="text-sm leading-6 text-slate-500">
                              {project.outcomeSummary.peopleReached.toLocaleString()} reached
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {project.attentionItems.map((item) => (
                            <span
                              key={`${project.id}-${item.label}`}
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ATTENTION_BADGE_CLASSES[item.tone]}`}
                            >
                              {item.label}
                            </span>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Project Portfolio
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Filter projects by urgency, ownership, and outcomes.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search projects, owners, or teams..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 sm:w-64"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as Status | "all")}
                  title="Filter by status"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="all">All statuses</option>
                  {(Object.keys(STATUS_CONFIG) as Status[]).map((status) => (
                    <option key={status} value={status}>
                      {STATUS_CONFIG[status].label}
                    </option>
                  ))}
                </select>
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value as Priority | "all")}
                  title="Filter by priority"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="all">All priorities</option>
                  {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((priority) => (
                    <option key={priority} value={priority}>
                      {PRIORITY_CONFIG[priority].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {isLoadingData ? (
            <OverviewTableSkeleton />
          ) : projects.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No projects on the board yet"
                description="Create your first project on the board and this overview will immediately start showing deadlines, ownership, and outcomes."
                icon={
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6z" />
                  </svg>
                }
              />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No projects match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1160px] w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 whitespace-nowrap">Project</th>
                    <th className="px-4 py-3 whitespace-nowrap">Owners</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 whitespace-nowrap">Deadline</th>
                    <th className="px-4 py-3 whitespace-nowrap">Last Update</th>
                    <th className="px-4 py-3 whitespace-nowrap">Outcomes</th>
                    <th className="px-4 py-3 whitespace-nowrap">Attention</th>
                    <th className="px-4 py-3 whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProjects.map((project) => (
                    <tr key={project.id} className="align-top transition-colors hover:bg-slate-50/80">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">{project.name}</p>
                        <p className="mt-1 max-w-sm text-sm text-slate-500">
                          {project.description || project.team || "No description yet"}
                        </p>
                        {project.status === "rejected" && rejectionFeedbacks[project.id]?.feedback && (
                          <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-100 bg-rose-50/50 px-2.5 py-1.5 max-w-sm">
                            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            <p className="text-xs text-rose-700 line-clamp-2">{rejectionFeedbacks[project.id].feedback}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {project.ownerNames.length > 0 ? project.ownerNames.join(", ") : "Unassigned"}
                      </td>
                      <td className="min-w-[160px] px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <PortfolioBadge
                            label={STATUS_CONFIG[project.status]?.label ?? project.status}
                            className={STATUS_CONFIG[project.status]?.classes ?? "bg-slate-100 text-slate-600 border-slate-200"}
                          />
                          <PortfolioBadge
                            label={PRIORITY_CONFIG[project.priority].label}
                            className={PRIORITY_CONFIG[project.priority].classes}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-800">
                          {project.deadline ? formatDate(project.deadline) : "No deadline"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">{formatDeadlineLabel(project)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-800">{formatRelativeUpdate(project.updatedAt)}</p>
                        <p className="mt-1 text-sm text-slate-500">{formatDateTime(project.updatedAt)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-emerald-600">
                          {project.outcomeSummary.peopleReached.toLocaleString()} people
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {project.outcomeSummary.activities} activit
                          {project.outcomeSummary.activities === 1 ? "y" : "ies"}
                        </p>
                      </td>
                      <td className="min-w-[190px] px-4 py-4">
                        {project.attentionItems.length === 0 ? (
                          <PortfolioBadge
                            label="On track"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          />
                        ) : (
                          <div className="flex max-w-xs flex-wrap items-center gap-2">
                            {project.attentionItems.slice(0, 2).map((item) => (
                              <PortfolioBadge
                                key={`${project.id}-${item.label}`}
                                label={getPortfolioAttentionLabel(item.label)}
                                title={item.label}
                                className={ATTENTION_BADGE_CLASSES[item.tone]}
                              />
                            ))}
                            {project.attentionItems.length > 2 ? (
                              <span className="text-xs font-medium text-slate-500">
                                +{project.attentionItems.length - 2} more
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="min-w-[160px] px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href="/projects"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800"
                          >
                            Board
                          </Link>
                          <Link
                            href={`/projects/impact?projectId=${project.id}`}
                            className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            Outcomes
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
