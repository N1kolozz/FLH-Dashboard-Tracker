"use client";

import Link from "next/link";
import AppSelect from "@/components/ui/Select";
import { useMemo, useState } from "react";
import type { ProjectRow } from "@/types";
import type { ImpactRecordRow } from "@/app/actions/impact";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import ProjectsSubnav from "@/components/ProjectsSubnav";
import {
  ATTENTION_BADGE_CLASSES,
  EMPTY_OUTCOME_SUMMARY,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  compareProjects,
  formatDate,
  formatDateTime,
  formatDeadlineLabel,
  formatRelativeUpdate,
  getDaysUntilDeadline,
  getPortfolioAttentionLabel,
  mergeOutcomeSummary,
  normalizeProjectName,
  rowToOutcome,
  rowToProject,
  type EnrichedProject,
  type MemberSummary,
  type OutcomeRecord,
  type OutcomeSummary,
  type Priority,
  type Project,
  type Status,
} from "@/features/projects/overview/model";
import {
  OverviewStatSkeleton,
  OverviewTableSkeleton,
  PortfolioBadge,
  SummaryCard,
} from "@/features/projects/overview/ui";

export default function ProjectsOverviewPage({
  initialProjects,
  initialOutcomes,
  initialMembers,
  initialRejectionFeedbacks,
}: {
  initialProjects: ProjectRow[];
  initialOutcomes: ImpactRecordRow[];
  initialMembers: Array<{ id: number; name: string }>;
  initialRejectionFeedbacks: Record<
    number,
    { feedback: string | null; reviewerName: string | null; rejectedAt: string | null }
  >;
}) {
  const [projects] = useState<Project[]>(initialProjects.map(rowToProject));
  const [outcomes] = useState<OutcomeRecord[]>(initialOutcomes.map(rowToOutcome));
  const [members] = useState<MemberSummary[]>(
    initialMembers
      .map((member) => ({ id: member.id, name: member.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [isLoadingData] = useState(false);
  const [rejectionFeedbacks] = useState<
    Record<number, { feedback: string | null; reviewerName: string | null; rejectedAt: string | null }>
  >(initialRejectionFeedbacks);
  const [detailProject, setDetailProject] = useState<EnrichedProject | null>(null);

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
        return {
          ...project,
          ownerNames,
          daysUntilDeadline,
          attentionItems: [],
          attentionScore: 0,
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

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <Link
                href="/projects"
                className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
              >
                Open Board
              </Link>
              <Link
                href="/projects/impact"
                className="flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto"
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <OverviewStatSkeleton key={idx} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Project Portfolio</h2>
                <p className="mt-0.5 text-xs text-slate-400">Filter projects by urgency, ownership, and outcomes.</p>
              </div>
              <p className="text-[11px] text-slate-400">
                {filteredProjects.length === enrichedProjects.length
                  ? `${enrichedProjects.length} project${enrichedProjects.length !== 1 ? "s" : ""}`
                  : `${filteredProjects.length} of ${enrichedProjects.length} projects`}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Search */}
              <div className="relative w-full">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects, owners, or teams…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-slate-400 hover:text-slate-600"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Mobile: Radix selects */}
              <div className="grid grid-cols-2 gap-2 sm:hidden">
                <AppSelect
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as Status | "all")}
                  options={[
                    { value: "all", label: "All statuses" },
                    ...(Object.keys(STATUS_CONFIG) as Status[]).map((s) => ({ value: s, label: STATUS_CONFIG[s].label })),
                  ]}
                  className="w-full"
                />
                <AppSelect
                  value={priorityFilter}
                  onValueChange={(v) => setPriorityFilter(v as Priority | "all")}
                  options={[
                    { value: "all", label: "All priorities" },
                    ...(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => ({ value: p, label: PRIORITY_CONFIG[p].label })),
                  ]}
                  className="w-full"
                />
                {(search || statusFilter !== "all" || priorityFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); }}
                    className="col-span-2 rounded-xl border border-rose-200 bg-rose-50 py-2 text-[11px] font-semibold text-rose-600 transition-colors hover:bg-rose-100"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {/* Desktop: chip buttons */}
              <div className="hidden sm:flex flex-wrap items-center gap-2">
                {/* Status chips */}
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${statusFilter === "all" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    All
                  </button>
                  {(Object.keys(STATUS_CONFIG) as Status[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${statusFilter === s ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>

                {/* Priority chips */}
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setPriorityFilter("all")}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${priorityFilter === "all" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    All
                  </button>
                  {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriorityFilter(priorityFilter === p ? "all" : p)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${priorityFilter === p ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>

                {/* Clear */}
                {(search || statusFilter !== "all" || priorityFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); }}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600 transition-colors hover:bg-rose-100"
                  >
                    Clear
                  </button>
                )}
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
                  {filteredProjects.map((project) => {
                    const ownerSummary =
                      project.ownerNames.length > 0
                        ? project.ownerNames.join(", ")
                        : "Unassigned";

                    return (
                      <tr
                        key={project.id}
                        onClick={() => setDetailProject(project)}
                        className="cursor-pointer align-middle transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3">
                          <p
                            title={project.name}
                            className="line-clamp-1 max-w-[260px] break-words font-semibold text-slate-900"
                          >
                            {project.name}
                          </p>
                          <p
                            title={project.description || project.team || undefined}
                            className="mt-0.5 line-clamp-1 max-w-[260px] break-words text-xs text-slate-500"
                          >
                            {project.description || project.team || "No description yet"}
                          </p>
                        </td>
                        <td
                          title={ownerSummary}
                          className="max-w-[180px] px-4 py-3 text-sm text-slate-600"
                        >
                          <p className="line-clamp-1 break-words">{ownerSummary}</p>
                        </td>
                        <td className="min-w-[160px] px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
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
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="font-medium text-slate-800">
                            {project.deadline ? formatDate(project.deadline) : "No deadline"}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatDeadlineLabel(project)}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="font-medium text-slate-800">{formatRelativeUpdate(project.updatedAt)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(project.updatedAt)}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="font-medium text-emerald-600">
                            {project.outcomeSummary.peopleReached.toLocaleString()} people
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {project.outcomeSummary.activities} activit
                            {project.outcomeSummary.activities === 1 ? "y" : "ies"}
                          </p>
                        </td>
                        <td className="min-w-[170px] px-4 py-3">
                          {project.attentionItems.length === 0 ? (
                            <PortfolioBadge
                              label="On track"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700"
                            />
                          ) : (
                            <div className="flex max-w-xs flex-wrap items-center gap-1.5">
                              {project.attentionItems.slice(0, 1).map((item) => (
                                <PortfolioBadge
                                  key={`${project.id}-${item.label}`}
                                  label={getPortfolioAttentionLabel(item.label)}
                                  title={item.label}
                                  className={ATTENTION_BADGE_CLASSES[item.tone]}
                                />
                              ))}
                              {project.attentionItems.length > 1 ? (
                                <span className="text-xs font-medium text-slate-500">
                                  +{project.attentionItems.length - 1} more
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Link
                            href={`/projects/impact?projectId=${project.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            Outcomes
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={detailProject !== null}
        onClose={() => setDetailProject(null)}
        title="Project details"
        maxWidth="max-w-2xl"
      >
        {detailProject ? (
          <div className="space-y-5">
            <div>
              <h3 className="break-words text-xl font-bold leading-tight text-slate-900">
                {detailProject.name}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <PortfolioBadge
                  label={STATUS_CONFIG[detailProject.status]?.label ?? detailProject.status}
                  className={
                    STATUS_CONFIG[detailProject.status]?.classes ??
                    "bg-slate-100 text-slate-600 border-slate-200"
                  }
                />
                <PortfolioBadge
                  label={`${PRIORITY_CONFIG[detailProject.priority].label} priority`}
                  className={PRIORITY_CONFIG[detailProject.priority].classes}
                />
                {detailProject.attentionItems.length === 0 ? (
                  <PortfolioBadge
                    label="On track"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  />
                ) : null}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Description
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {detailProject.description?.trim() || "No description added yet."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Deadline
                </p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {detailProject.deadline
                    ? formatDate(detailProject.deadline)
                    : "No deadline"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDeadlineLabel(detailProject)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Last update
                </p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {formatRelativeUpdate(detailProject.updatedAt)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDateTime(detailProject.updatedAt)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Team
                </p>
                <p className="mt-1 break-words text-sm font-medium text-slate-800">
                  {detailProject.team?.trim() || "Not assigned"}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                  Outcomes
                </p>
                <p className="mt-1 text-sm font-medium text-emerald-700">
                  {detailProject.outcomeSummary.peopleReached.toLocaleString()} people reached
                </p>
                <p className="mt-0.5 text-xs text-emerald-700/80">
                  {detailProject.outcomeSummary.activities} activit
                  {detailProject.outcomeSummary.activities === 1 ? "y" : "ies"} logged
                </p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Owners ({detailProject.ownerNames.length})
              </p>
              {detailProject.ownerNames.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">No one assigned yet.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detailProject.ownerNames.map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {detailProject.attentionItems.length > 0 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Attention
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detailProject.attentionItems.map((item) => (
                    <PortfolioBadge
                      key={`${detailProject.id}-detail-${item.label}`}
                      label={item.label}
                      className={ATTENTION_BADGE_CLASSES[item.tone]}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {detailProject.status === "rejected" &&
            rejectionFeedbacks[detailProject.id]?.feedback ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">
                  Rejection feedback
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-rose-700">
                  {rejectionFeedbacks[detailProject.id].feedback}
                </p>
                {rejectionFeedbacks[detailProject.id].reviewerName ? (
                  <p className="mt-1 text-xs text-rose-600/80">
                    — {rejectionFeedbacks[detailProject.id].reviewerName}
                    {rejectionFeedbacks[detailProject.id].rejectedAt
                      ? ` · ${formatDateTime(rejectionFeedbacks[detailProject.id].rejectedAt!)}`
                      : ""}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Link
                href="/projects"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Open board
              </Link>
              <Link
                href={`/projects/impact?projectId=${detailProject.id}`}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                View outcomes
              </Link>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
