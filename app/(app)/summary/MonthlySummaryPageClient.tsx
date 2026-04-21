"use client";

import { useEffect, useRef, useState } from "react";
import { getMonthlySummary } from "@/app/actions/monthly-summary";
import type { MonthlySummaryData } from "@/types";
import MonthlySummaryPresentation from "./MonthlySummaryPresentation";
import FlhIconMark from "@/components/FlhIconMark";

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getCurrentYearMonths() {
  const months: string[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  for (let m = currentMonth; m >= 0; m--) {
    months.push(`${year}-${String(m + 1).padStart(2, "0")}`);
  }
  return months;
}

/* ─── Department Colors ─── */
const DEPT_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  "PR & Social": { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", border: "border-purple-200" },
  Logistics: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-200" },
  Projects: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200" },
  Management: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-200" },
  Other: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", border: "border-slate-200" },
};

function getDeptColor(dept: string) {
  return DEPT_COLORS[dept] || DEPT_COLORS["Other"];
}

export default function MonthlySummaryPageClient({
  initialAuthorized,
  initialSelectedMonth,
  initialData,
  initialError,
}: {
  initialAuthorized: boolean;
  initialSelectedMonth: string;
  initialData: MonthlySummaryData | null;
  initialError: string;
}) {
  const [authorized] = useState<boolean>(initialAuthorized);
  const [selectedMonth, setSelectedMonth] = useState(initialSelectedMonth);
  const [data, setData] = useState<MonthlySummaryData | null>(initialData);
  const [loading, setLoading] = useState(initialAuthorized && !initialData && !initialError);
  const [error, setError] = useState(initialError);
  const [presenting, setPresenting] = useState(false);
  const didHydrateMonthRef = useRef(false);

  const availableMonths = getCurrentYearMonths();

  // Fetch data when month changes
  useEffect(() => {
    if (authorized !== true) return;
    if (!didHydrateMonthRef.current) {
      didHydrateMonthRef.current = true;
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const res = await getMonthlySummary(selectedMonth);
      if (cancelled) return;
      if ("error" in res) {
        setError(res.error);
        setData(null);
      } else {
        setData(res.data);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, authorized]);

  // Unauthorized view
  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100 max-w-md">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-9V3m0 0a9 9 0 019 9m-9-9a9 9 0 00-9 9" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-500">Only the HEAD and ADMIN roles can access the Monthly Summary feature.</p>
        </div>
      </div>
    );
  }

  // Presentation mode
  if (presenting && data) {
    return (
      <MonthlySummaryPresentation
        data={data}
        onExit={() => setPresenting(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-purple-200/70 bg-gradient-to-r from-violet-50/70 via-purple-50/65 to-fuchsia-50/70 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Monthly Summary
                <FlhIconMark
                  width={20}
                  height={21}
                  title="FLH Logo"
                  className="h-5 w-5"
                />
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Full monthly overview of all NGO activities — present to the team
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              {/* Month selector */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-10 w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-300 sm:w-48"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>

              {/* Start Presentation button */}
              <button
                onClick={() => setPresenting(true)}
                disabled={!data || loading}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:from-purple-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Start Presentation
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-white border border-slate-100" />
              ))}
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-white border border-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
        ) : data ? (
          <>
            {/* Stats summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
                <p className="text-xs text-slate-500 font-medium">Team Members</p>
                <p className="text-2xl font-bold text-slate-800">{data.totalMembers}</p>
              </div>
              <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
                <p className="text-xs text-slate-500 font-medium">Active Projects</p>
                <p className="text-2xl font-bold text-slate-800">{data.activeProjects}</p>
                <p className="text-[10px] text-emerald-600 font-medium">{data.completedProjects} completed</p>
              </div>
              <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
                <p className="text-xs text-slate-500 font-medium">Events</p>
                <p className="text-2xl font-bold text-slate-800">{data.totalEvents}</p>
              </div>
              <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
                <p className="text-xs text-slate-500 font-medium">People Reached</p>
                <p className="text-2xl font-bold text-slate-800">{data.totalPeopleReached.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
                <p className="text-xs text-slate-500 font-medium">Attendance</p>
                <p className="text-2xl font-bold text-slate-800">
                  {data.overallAttendanceRate != null ? `${data.overallAttendanceRate}%` : "N/A"}
                </p>
              </div>
            </div>

            {/* Department cards */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                Department Breakdown
              </h2>

              {data.departments.map((dept) => {
                const colors = getDeptColor(dept.department);
                return (
                  <div
                    key={dept.department}
                    className={`bg-white rounded-xl border ${colors.border} p-5 shadow-sm hover:shadow-md transition-shadow`}
                  >
                    {/* Dept header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
                        <h3 className="text-base font-bold text-slate-800">{dept.department}</h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {dept.memberCount} members
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span><strong className="text-slate-700">{dept.activeProjects}</strong> active</span>
                        <span><strong className="text-emerald-600">{dept.completedProjects}</strong> done</span>
                        <span><strong className="text-slate-700">{dept.totalEvents}</strong> events</span>
                        {dept.attendanceRate != null && (
                          <span><strong className="text-slate-700">{dept.attendanceRate}%</strong> attendance</span>
                        )}
                      </div>
                    </div>

                    {/* Quick preview grid */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      {/* Projects preview */}
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Projects</p>
                        {dept.projects.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No projects</p>
                        ) : (
                          <div className="space-y-1">
                            {dept.projects.slice(0, 3).map((p) => (
                              <p key={p.id} className="text-xs text-slate-600 truncate">• {p.name}</p>
                            ))}
                            {dept.projects.length > 3 && (
                              <p className="text-[10px] text-slate-400">+{dept.projects.length - 3} more</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Events preview */}
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Events</p>
                        {dept.events.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No events</p>
                        ) : (
                          <div className="space-y-1">
                            {dept.events.slice(0, 3).map((e) => (
                              <p key={e.id} className="text-xs text-slate-600 truncate">• {e.title}</p>
                            ))}
                            {dept.events.length > 3 && (
                              <p className="text-[10px] text-slate-400">+{dept.events.length - 3} more</p>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>

          </>
        ) : null}
      </div>
    </div>
  );
}
