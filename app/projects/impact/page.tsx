"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getProjects } from "@/app/actions/projects";
import type { ProjectRow } from "@/types";
import { getImpactRecords, createImpactRecord, updateImpactRecord, deleteImpactRecord } from "@/app/actions/impact";
import type { ImpactRecordRow } from "@/app/actions/impact";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import ProjectsSubnav from "@/components/ProjectsSubnav";
import { getCurrentSession } from "@/app/actions/session";
import type { Session } from "@/lib/auth";
import { getStoredSkeletonCount, resolveSkeletonCount, setStoredSkeletonCount } from "@/lib/loading-skeleton";

/* ─── Types ─── */
type ActivityType = "workshop" | "training" | "outreach" | "mentoring" | "event" | "other";

interface ImpactRecord {
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

interface ProjectOption {
  id: number;
  name: string;
}

const ACTIVITY_CONFIG: Record<ActivityType, { label: string; color: string }> = {
  workshop: { label: "Workshop", color: "bg-purple-100 text-purple-700" },
  training: { label: "Training", color: "bg-blue-100 text-blue-700" },
  outreach: { label: "Outreach", color: "bg-blue-100 text-blue-700" },
  mentoring: { label: "Mentoring", color: "bg-amber-100 text-amber-700" },
  event: { label: "Event", color: "bg-rose-100 text-rose-700" },
  other: { label: "Other", color: "bg-slate-100 text-slate-600" },
};

const EMPTY: ImpactRecord = {
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
const IMPACT_RECORD_SKELETON_STORAGE_KEY = "impact-record-skeleton-count";
const IMPACT_PROJECT_SKELETON_STORAGE_KEY = "impact-project-skeleton-count";

function getImpactPayload(record: ImpactRecord): {
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

function rowToProjectOption(row: ProjectRow): ProjectOption {
  return {
    id: row.id,
    name: row.name,
  };
}

function rowToRecord(row: ImpactRecordRow): ImpactRecord {
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

function buildProjectTotals(items: ImpactRecord[]) {
  const map: Record<string, number> = {};

  items.forEach((record) => {
    map[record.projectName] = (map[record.projectName] || 0) + record.peopleReached;
  });

  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function getEvidenceHref(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}

function sortRecords(items: ImpactRecord[]) {
  return [...items].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function ImpactSummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="animate-pulse rounded-xl border border-slate-100 bg-white p-5 text-center shadow-sm">
          <div className="mx-auto h-8 w-24 rounded-2xl bg-slate-200" />
          <div className="mx-auto mt-2 h-3 w-24 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function ImpactChartSkeleton({ count }: { count: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 h-4 w-40 animate-pulse rounded-full bg-slate-200" />
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="animate-pulse">
            <div className="mb-1 flex items-center justify-between">
              <div className="h-4 w-28 rounded-full bg-slate-100" />
              <div className="h-4 w-20 rounded-full bg-slate-100" />
            </div>
            <div className="h-2.5 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ImpactTableSkeleton({ count }: { count: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Activity</th>
            <th className="px-4 py-3">Result</th>
            <th className="px-4 py-3">Evidence</th>
            <th className="px-4 py-3 text-right">People Reached</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: count }).map((_, idx) => (
            <tr key={idx} className="animate-pulse">
              <td className="px-4 py-3"><div className="h-4 w-20 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3"><div className="h-4 w-36 rounded-full bg-slate-200" /></td>
              <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3"><div className="h-4 w-40 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3"><div className="h-4 w-20 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3 text-right"><div className="ml-auto h-4 w-16 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3"><div className="h-6 w-12 rounded-md bg-slate-100" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImpactPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId");
  const [records, setRecords] = useState<ImpactRecord[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ImpactRecord>(EMPTY);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [cachedRecordCount, setCachedRecordCount] = useState(0);
  const [cachedProjectCount, setCachedProjectCount] = useState(0);
  const [filterProjectId, setFilterProjectId] = useState(projectIdFromUrl ?? "all");
  const [filterActivity, setFilterActivity] = useState<ActivityType | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    setCachedRecordCount(getStoredSkeletonCount(IMPACT_RECORD_SKELETON_STORAGE_KEY, 0));
    setCachedProjectCount(getStoredSkeletonCount(IMPACT_PROJECT_SKELETON_STORAGE_KEY, 0));
  }, []);

  useEffect(() => {
    async function init() {
      setIsLoadingData(true);
      try {
        const [sess, projectRes, recordRes] = await Promise.all([
          getCurrentSession(),
          getProjects(),
          getImpactRecords(),
        ]);
        setSession(sess);

        if (projectRes.success && projectRes.projects) {
          const nextProjects = projectRes.projects
            .map(rowToProjectOption)
            .sort((a, b) => a.name.localeCompare(b.name));
          setProjects(nextProjects);
        }

        if (recordRes.success && recordRes.records) {
          setRecords(sortRecords(recordRes.records.map(rowToRecord)));
        }
      } finally {
        setIsLoadingData(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!projectIdFromUrl) {
      setFilterProjectId("all");
      return;
    }

    if (projects.length > 0 && !projects.some((project) => String(project.id) === projectIdFromUrl)) {
      setFilterProjectId("all");
      return;
    }

    setFilterProjectId(projectIdFromUrl);
  }, [projectIdFromUrl, projects]);

  const canEdit = session && (
    session.role === "ADMIN" || 
    session.role === "HEAD" || 
    session.department === "Projects"
  );

  const refreshRecords = async (showLoading = true) => {
    if (showLoading) setIsLoadingData(true);
    try {
      const res = await getImpactRecords();
      if (res.success && res.records) {
        setRecords(sortRecords(res.records.map(rowToRecord)));
      }
    } finally {
      if (showLoading) setIsLoadingData(false);
    }
  };

  const setEditingProject = (projectIdValue: string) => {
    const nextProjectId = projectIdValue ? Number(projectIdValue) : null;
    const selectedProject = nextProjectId
      ? projects.find((project) => project.id === nextProjectId) ?? null
      : null;

    setEditing((current) => ({
      ...current,
      projectId: nextProjectId,
      projectName: selectedProject?.name ?? current.projectName,
    }));
  };

  const saveRecord = async () => {
    const selectedProject = editing.projectId
      ? projects.find((project) => project.id === editing.projectId) ?? null
      : null;
    const nextRecord = {
      ...editing,
      projectId: selectedProject?.id ?? null,
      projectName: selectedProject?.name ?? editing.projectName.trim(),
    };

    if (!selectedProject || !nextRecord.date || nextRecord.peopleReached <= 0) return;

    if (nextRecord.id) {
      const previousRecord = records.find((record) => record.id === nextRecord.id);

      setRecords((current) =>
        sortRecords(
          current.map((record) =>
            record.id === nextRecord.id
              ? {
                  ...nextRecord,
                  createdAt: previousRecord?.createdAt ?? record.createdAt,
                }
              : record
          )
        )
      );

      const result = await updateImpactRecord(nextRecord.id, getImpactPayload(nextRecord));

      if (!result.success) {
        if (previousRecord) {
          setRecords((current) =>
            sortRecords(
              current.map((record) =>
                record.id === previousRecord.id ? previousRecord : record
              )
            )
          );
        }
        return;
      }
    } else {
      const result = await createImpactRecord(getImpactPayload(nextRecord));

      if (!result.success || typeof result.id !== "number") {
        return;
      }

      setRecords((current) =>
        sortRecords([
          {
            ...nextRecord,
            id: result.id,
            createdAt:
              typeof result.createdAt === "string" && result.createdAt
                ? result.createdAt
                : new Date().toISOString(),
          },
          ...current,
        ])
      );
    }

    setModalOpen(false);
    setEditing(EMPTY);
    void refreshRecords(false);
  };

  const handleDeleteRecord = async (id: number) => {
    const deletedRecord = records.find((record) => record.id === id);

    setRecords((current) => current.filter((record) => record.id !== id));

    const result = await deleteImpactRecord(id);

    if (!result.success) {
      if (deletedRecord) {
        setRecords((current) => sortRecords([deletedRecord, ...current]));
      }
      return;
    }

    void refreshRecords(false);
  };

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        if (filterProjectId !== "all" && String(record.projectId) !== filterProjectId) {
          return false;
        }

        if (filterActivity !== "all" && record.activityType !== filterActivity) {
          return false;
        }

        if (startDate && record.date < startDate) {
          return false;
        }

        if (endDate && record.date > endDate) {
          return false;
        }

        return true;
      }),
    [endDate, filterActivity, filterProjectId, records, startDate]
  );

  const totalPeople = filteredRecords.reduce((sum, record) => sum + record.peopleReached, 0);
  const totalActivities = filteredRecords.length;
  const unlinkedRecordCount = records.filter((record) => record.projectId === null).length;
  const canAddOutcome = Boolean(canEdit && projects.length > 0);
  const hasActiveFilters =
    filterProjectId !== "all" || filterActivity !== "all" || Boolean(startDate) || Boolean(endDate);
  const allByProject = useMemo(() => buildProjectTotals(records), [records]);
  const byProject = useMemo(() => buildProjectTotals(filteredRecords), [filteredRecords]);
  const selectedProject = useMemo(
    () => projects.find((project) => String(project.id) === filterProjectId) ?? null,
    [filterProjectId, projects]
  );

  const maxProjectImpact = Math.max(...byProject.map(([, v]) => v), 1);
  const sortedRecords = [...filteredRecords].sort((a, b) => b.date.localeCompare(a.date));
  const impactRecordSkeletonCount = resolveSkeletonCount(
    records.length,
    cachedRecordCount
  );
  const impactProjectSkeletonCount = resolveSkeletonCount(
    allByProject.length,
    cachedProjectCount
  );

  useEffect(() => {
    if (isLoadingData) return;

    setCachedRecordCount(records.length);
    setStoredSkeletonCount(IMPACT_RECORD_SKELETON_STORAGE_KEY, records.length);
    setCachedProjectCount(allByProject.length);
    setStoredSkeletonCount(IMPACT_PROJECT_SKELETON_STORAGE_KEY, allByProject.length);
  }, [allByProject.length, isLoadingData, records.length]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const currentProjectId = params.get("projectId") ?? "all";

    if (filterProjectId === currentProjectId) {
      return;
    }

    if (filterProjectId === "all") {
      params.delete("projectId");
    } else {
      params.set("projectId", filterProjectId);
    }

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [filterProjectId, pathname, router, searchParams]);

  const clearFilters = () => {
    setFilterProjectId("all");
    setFilterActivity("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-purple-200/70 bg-blue-100/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Project Outcomes
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isLoadingData
                  ? "Loading project outcomes..."
                  : "Track beneficiaries, activities, and results across projects"}
              </p>
            </div>
            {canEdit && (
              <button
                disabled={!canAddOutcome}
                title={!canAddOutcome ? "Create a project on the board first" : undefined}
                onClick={() => { setEditing({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModalOpen(true); }}
                className="h-10 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:hover:bg-slate-300 sm:w-auto"
              >+ Add Outcome</button>
            )}
          </div>
          <ProjectsSubnav className="mt-4" />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {!isLoadingData && unlinkedRecordCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            {unlinkedRecordCount} outcome record{unlinkedRecordCount !== 1 ? "s still rely" : " still relies"} on
            the old text-only project name. Open those records, choose the correct project, and save to fully link
            them to the board.
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Filters</h2>
              <p className="mt-1 text-sm text-slate-500">
                Filter Project Outcomes by project, activity type, and date range.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <select
                value={filterProjectId}
                onChange={(event) => setFilterProjectId(event.target.value)}
                title="Filter by project"
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              <select
                value={filterActivity}
                onChange={(event) => setFilterActivity(event.target.value as ActivityType | "all")}
                title="Filter by activity type"
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                <option value="all">All activity types</option>
                {(Object.keys(ACTIVITY_CONFIG) as ActivityType[]).map((activity) => (
                  <option key={activity} value={activity}>
                    {ACTIVITY_CONFIG[activity].label}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                title="Start date"
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
              />

              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                title="End date"
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
              />

              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Clear Filters
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-700">{filteredRecords.length}</span> of{" "}
            <span className="font-semibold text-slate-700">{records.length}</span> outcome records.
          </p>
          {selectedProject ? (
            <p className="mt-2 text-sm text-slate-500">
              Focused on <span className="font-semibold text-slate-700">{selectedProject.name}</span> from the
              Project Portfolio view.
            </p>
          ) : null}
        </div>

        {/* Summary */}
        {isLoadingData ? (
          <ImpactSummarySkeleton />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
              <p className="text-3xl font-bold text-blue-600">{totalPeople.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1 uppercase font-semibold">People Reached</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
              <p className="text-3xl font-bold text-slate-900">{totalActivities}</p>
              <p className="text-xs text-slate-500 mt-1 uppercase font-semibold">Activities</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
              <p className="text-3xl font-bold text-purple-600">{byProject.length}</p>
              <p className="text-xs text-slate-500 mt-1 uppercase font-semibold">Projects</p>
            </div>
          </div>
        )}

        <div>
          {isLoadingData ? (
            <ImpactChartSkeleton count={impactProjectSkeletonCount} />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-600">
                Outcome Reach by Project
              </h3>
              {byProject.length === 0 ? (
                <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No projects match the current filters.
                </div>
              ) : (
                <div className="space-y-3">
                  {byProject.map(([name, total]) => (
                    <div key={name}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{name}</span>
                        <span className="text-sm font-semibold text-slate-900">{total.toLocaleString()} people</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100">
                        <div
                          className="h-2.5 rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${(total / maxProjectImpact) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Records list */}
        {isLoadingData ? (
          <ImpactTableSkeleton count={impactRecordSkeletonCount} />
        ) : records.length === 0 ? (
          <EmptyState
            title="No project outcomes yet"
            description={
              projects.length === 0
                ? "Create a project on the board first, then log outcomes against that project."
                : "Start logging beneficiaries and activities to measure each project's real-world results."
            }
            icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            action={canAddOutcome ? { label: "Add Outcome Record", onClick: () => { setEditing({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModalOpen(true); } } : undefined}
          />
        ) : filteredRecords.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            No outcome records match the current filters.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Evidence</th>
                  <th className="px-4 py-3 text-right">People Reached</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{r.projectName}</span>
                        {!r.projectId && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Needs relink
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ACTIVITY_CONFIG[r.activityType].color}`}>{ACTIVITY_CONFIG[r.activityType].label}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.resultSummary ? (
                        <span className="line-clamp-2">{r.resultSummary}</span>
                      ) : (
                        <span className="text-slate-400">No summary</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.evidenceLink.trim() ? (
                        <a
                          href={getEvidenceHref(r.evidenceLink) ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          Open link
                        </a>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{r.peopleReached.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setEditing(r); setModalOpen(true); }} className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded transition-colors">{canEdit ? "Edit" : "View"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(EMPTY); }} title={editing.id ? (canEdit ? "Edit Outcome Record" : "View Outcome Record") : "Add Outcome Record"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project *</label>
            <select
              disabled={!canEdit || projects.length === 0}
              value={editing.projectId ? String(editing.projectId) : ""}
              onChange={(e) => setEditingProject(e.target.value)}
              title="Project"
              className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50"
            >
              <option value="">
                {projects.length === 0
                  ? "Create a project first"
                  : editing.id && editing.projectName && !editing.projectId
                    ? "Legacy record not linked yet"
                    : "Select a project"}
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {editing.projectId === null && editing.projectName ? (
              <p className="mt-2 text-xs text-amber-700">
                This record still uses the old project name{" "}
                <span className="font-semibold">{editing.projectName}</span>. Choose the correct project and save to
                upgrade it.
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">People Reached *</label>
              <input disabled={!canEdit} type="number" min={1} value={editing.peopleReached || ""} onChange={(e) => setEditing({ ...editing, peopleReached: parseInt(e.target.value) || 0 })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50" placeholder="50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input disabled={!canEdit}
                type="date"
                value={editing.date}
                onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                title="Date"
                className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Activity Type</label>
              <select disabled={!canEdit}
                value={editing.activityType}
                onChange={(e) => setEditing({ ...editing, activityType: e.target.value as ActivityType })}
                title="Activity Type"
                className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50"
              >
                {(Object.keys(ACTIVITY_CONFIG) as ActivityType[]).map((a) => (<option key={a} value={a}>{ACTIVITY_CONFIG[a].label}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Result Summary</label>
            <textarea
              disabled={!canEdit}
              value={editing.resultSummary}
              onChange={(e) => setEditing({ ...editing, resultSummary: e.target.value })}
              rows={3}
              className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 resize-none disabled:bg-slate-50"
              placeholder="What changed or what was achieved?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Evidence Link</label>
            <input
              disabled={!canEdit}
              type="url"
              value={editing.evidenceLink}
              onChange={(e) => setEditing({ ...editing, evidenceLink: e.target.value })}
              className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50"
              placeholder="https://drive.google.com/... or other proof link"
            />
          </div>
          {canEdit && (
            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveRecord} disabled={!editing.projectId || !editing.date || editing.peopleReached <= 0} className="flex-1  px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors">{editing.id ? "Save Changes" : "Add Outcome"}</button>
              {editing.id ? (
                <button onClick={() => { void handleDeleteRecord(editing.id); setModalOpen(false); setEditing(EMPTY); }} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors">Delete</button>
              ) : null}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default function ImpactPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-sm text-slate-400">Loading...</div>
      </div>
    }>
      <ImpactPageContent />
    </Suspense>
  );
}
