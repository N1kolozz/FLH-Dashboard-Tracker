"use client";

import { useState, useEffect } from "react";
import { getWorkloadData } from "@/app/actions/workload";
import type { WorkloadMember } from "@/app/actions/workload";
import TeamSubnav from "@/components/TeamSubnav";
import { avatarColor, getInitials } from "@/lib/member-avatar";

/* ─── Constants ─── */

const DEPT_CONFIG: Record<string, { color: string; dot: string }> = {
  "PR & Social": { color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  Logistics: { color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  Projects: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  Management: { color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  Other: { color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planning: { label: "Planning", color: "bg-slate-100 text-slate-600" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
  review: { label: "Review", color: "bg-amber-100 text-amber-700" },
  completed: { label: "Done", color: "bg-emerald-100 text-emerald-700" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: "High", color: "text-red-600" },
  medium: { label: "Medium", color: "text-amber-600" },
  low: { label: "Low", color: "text-emerald-600" },
};

/* ─── Helpers ─── */

function getWorkloadLevel(score: number): { label: string; bar: string; text: string; bg: string } {
  if (score === 0) return { label: "Free", bar: "bg-slate-200", text: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
  if (score <= 1) return { label: "Light", bar: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
  if (score <= 3) return { label: "Moderate", bar: "bg-blue-400", text: "text-blue-700", bg: "bg-blue-50 border-blue-200" };
  if (score <= 5) return { label: "Busy", bar: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50 border-amber-200" };
  return { label: "Overloaded", bar: "bg-red-400", text: "text-red-700", bg: "bg-red-50 border-red-200" };
}

function workloadScore(m: WorkloadMember) {
  return m.activeProjects * 1.5 + m.upcomingEvents;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

/* ─── Skeleton ─── */

function WorkloadSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="animate-pulse bg-white rounded-xl border border-purple-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-36 rounded-full bg-slate-200" />
              <div className="h-3 w-24 rounded-full bg-slate-100" />
            </div>
            <div className="h-6 w-16 rounded-full bg-slate-100" />
          </div>
          <div className="h-2 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/* ─── Row Card ─── */

function MemberWorkloadCard({
  member,
  maxScore,
  expanded,
  onToggle,
}: {
  member: WorkloadMember;
  maxScore: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const score = workloadScore(member);
  const pct = maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0;
  const level = getWorkloadLevel(score);
  const dept = DEPT_CONFIG[member.department] || DEPT_CONFIG["Other"];

  return (
    <div className={`bg-white rounded-xl border transition-all duration-200 ${expanded ? "border-purple-300 shadow-md shadow-purple-100/50" : "border-purple-200 hover:border-purple-300 hover:shadow-sm"}`}>
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 flex items-center gap-3"
        aria-expanded={expanded}
      >
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full ${avatarColor(member.name)} text-white flex items-center justify-center text-sm font-bold shadow-sm shrink-0`}>
          {getInitials(member.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-sm font-semibold text-slate-800 truncate">{member.name}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${dept.color}`}>
              {member.department}
            </span>
            {member.role === "ADMIN" && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 shrink-0">Admin</span>
            )}
            {member.role === "HEAD" && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0">Head</span>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${level.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-[10px] font-semibold whitespace-nowrap ${level.text}`}>
              {level.label}
            </span>
          </div>
        </div>

        {/* Count chips */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg" title="Active projects">
            <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-[11px] font-bold text-blue-700">{member.activeProjects}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-violet-50 border border-violet-200 rounded-lg" title="Upcoming events">
            <svg className="w-3 h-3 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[11px] font-bold text-violet-700">{member.upcomingEvents}</span>
          </div>

          {/* Expand chevron */}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ml-1 ${expanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 grid sm:grid-cols-2 gap-4">
          {/* Active Projects */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Active Projects ({member.activeProjects})
            </p>
            {member.projectDetails.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No active projects assigned</p>
            ) : (
              <div className="space-y-1.5">
                {member.projectDetails.map((p) => {
                  const st = STATUS_CONFIG[p.status] || { label: p.status, color: "bg-slate-100 text-slate-600" };
                  const pr = PRIORITY_CONFIG[p.priority] || { label: p.priority, color: "text-slate-500" };
                  return (
                    <div key={p.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{p.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${st.color}`}>{st.label}</span>
                          <span className={`text-[10px] font-medium ${pr.color}`}>↑ {pr.label}</span>
                          {p.deadline && (
                            <span className="text-[10px] text-slate-400">Due {formatDate(p.deadline)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upcoming Events ({member.upcomingEvents})
            </p>
            {member.eventDetails.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No upcoming events assigned</p>
            ) : (
              <div className="space-y-1.5">
                {member.eventDetails.map((e) => {
                  const dept = DEPT_CONFIG[e.department] || DEPT_CONFIG["Other"];
                  return (
                    <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dept.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{e.title}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(e.date)} · {e.department}</p>
                      </div>
                    </div>
                  );
                })}
                {member.upcomingEvents > 5 && (
                  <p className="text-[10px] text-slate-400 text-center">+{member.upcomingEvents - 5} more</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Page ─── */

type SortKey = "workload" | "activeProjects";
type FilterDept = "all" | string;

export default function WorkloadPage() {
  const [members, setMembers] = useState<WorkloadMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("workload");
  const [filterDept, setFilterDept] = useState<FilterDept>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getWorkloadData();
      if ("error" in res) {
        setError(res.error);
      } else {
        setMembers(res.members);
      }
      setLoading(false);
    }
    load();
  }, []);

  const sorted = [...members]
    .filter((m) => {
      if (filterDept !== "all" && m.department !== filterDept) return false;
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "workload") return workloadScore(b) - workloadScore(a);
      if (sortKey === "activeProjects") return b.activeProjects - a.activeProjects;
      return 0;
    });

  const maxScore = Math.max(...sorted.map(workloadScore), 1);

  // Summary stats
  const overloaded = members.filter((m) => getWorkloadLevel(workloadScore(m)).label === "Overloaded");
  const free = members.filter((m) => workloadScore(m) === 0);
  const totalActive = members.reduce((s, m) => s + m.activeProjects, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-purple-200/70 bg-gradient-to-r from-violet-50/70 via-purple-50/65 to-fuchsia-50/70 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Workload View
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Who owns what — spot imbalances at a glance</p>
            </div>

            <TeamSubnav active="workload" className="xl:shrink-0" />
          </div>

          {/* Summary stats */}
          {!loading && members.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-xs text-slate-600"><span className="font-bold text-slate-800">{totalActive}</span> active projects across team</span>
              </div>
              {overloaded.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-xl border border-red-200 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs text-red-700"><span className="font-bold">{overloaded.length}</span> member{overloaded.length !== 1 ? "s" : ""} overloaded</span>
                </div>
              )}
              {free.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-emerald-700"><span className="font-bold">{free.length}</span> member{free.length !== 1 ? "s" : ""} with no assignments</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Controls */}
        <div className="mb-5 grid grid-cols-1 gap-2 md:grid-cols-2 xl:flex xl:flex-wrap xl:items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 xl:w-48"
          />
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 xl:w-44"
          >
            <option value="all">All departments</option>
            {Object.keys(DEPT_CONFIG).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 xl:w-52"
          >
            <option value="workload">Sort: Busiest first</option>
            <option value="activeProjects">Sort: Most projects</option>
          </select>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-2 pt-1 md:col-span-2 xl:ml-auto xl:justify-end xl:pt-0">
            {[
              { label: "Free", bar: "bg-slate-300" },
              { label: "Light", bar: "bg-emerald-400" },
              { label: "Moderate", bar: "bg-blue-400" },
              { label: "Busy", bar: "bg-amber-400" },
              { label: "Overloaded", bar: "bg-red-400" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded-full ${l.bar}`} />
                <span className="text-[10px] text-slate-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Icon legend for chips */}
        <div className="flex items-center gap-4 mb-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded">
              <svg className="w-2.5 h-2.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-blue-600 font-bold">n</span>
            </div>
            <span>active projects</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-violet-50 border border-violet-200 rounded">
              <svg className="w-2.5 h-2.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-violet-600 font-bold">n</span>
            </div>
            <span>upcoming events (90 days)</span>
          </div>
          <span className="ml-auto text-slate-300">Click a row to expand</span>
        </div>

        {/* Content */}
        {loading ? (
          <WorkloadSkeleton />
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium">No team members yet</p>
            <p className="text-xs mt-1">Add members in the Team Directory first.</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No members match this filter.</div>
        ) : (
          <div className="space-y-2">
            {sorted.map((member) => (
              <MemberWorkloadCard
                key={member.id}
                member={member}
                maxScore={maxScore}
                expanded={expandedId === member.id}
                onToggle={() => setExpandedId(expandedId === member.id ? null : member.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
