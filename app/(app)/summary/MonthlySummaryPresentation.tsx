"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { gsap } from "gsap";
import type {
  MonthlySummaryData,
  DepartmentSummary,
} from "@/types";
import FlhIconMark from "@/components/FlhIconMark";

/* ─── Department Colors ─── */
const DEPT_COLORS: Record<string, { gradient: string; accent: string; badge: string; dot: string; light: string }> = {
  "PR & Social": {
    gradient: "from-purple-600 to-fuchsia-600",
    accent: "text-purple-300",
    badge: "bg-purple-500/30 text-purple-200 border-purple-400/30",
    dot: "bg-purple-400",
    light: "bg-purple-50",
  },
  Logistics: {
    gradient: "from-blue-600 to-cyan-600",
    accent: "text-blue-300",
    badge: "bg-blue-500/30 text-blue-200 border-blue-400/30",
    dot: "bg-blue-400",
    light: "bg-blue-50",
  },
  Projects: {
    gradient: "from-emerald-600 to-teal-600",
    accent: "text-emerald-300",
    badge: "bg-emerald-500/30 text-emerald-200 border-emerald-400/30",
    dot: "bg-emerald-400",
    light: "bg-emerald-50",
  },
  Management: {
    gradient: "from-amber-600 to-orange-600",
    accent: "text-amber-300",
    badge: "bg-amber-500/30 text-amber-200 border-amber-400/30",
    dot: "bg-amber-400",
    light: "bg-amber-50",
  },
  Other: {
    gradient: "from-slate-600 to-gray-600",
    accent: "text-slate-300",
    badge: "bg-slate-500/30 text-slate-200 border-slate-400/30",
    dot: "bg-slate-400",
    light: "bg-slate-50",
  },
};

function getDeptColor(dept: string) {
  return DEPT_COLORS[dept] || DEPT_COLORS["Other"];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planning: { label: "Planning", color: "bg-slate-100 text-slate-700" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
  review: { label: "Review", color: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700" },
};

/* ─── Slide Types ─── */
type SlideType =
  | { kind: "title" }
  | { kind: "overview" }
  | { kind: "department-intro"; dept: DepartmentSummary }
  | { kind: "department-projects"; dept: DepartmentSummary }
  | { kind: "department-events"; dept: DepartmentSummary }
  | { kind: "department-impact"; dept: DepartmentSummary }
  | { kind: "closing" };

function buildSlides(data: MonthlySummaryData): SlideType[] {
  const slides: SlideType[] = [{ kind: "title" }, { kind: "overview" }];

  for (const dept of data.departments) {
    slides.push({ kind: "department-intro", dept });
    if (dept.projects.length > 0)
      slides.push({ kind: "department-projects", dept });
    if (dept.events.length > 0)
      slides.push({ kind: "department-events", dept });
    if (dept.impactRecords.length > 0)
      slides.push({ kind: "department-impact", dept });
  }

  slides.push({ kind: "closing" });
  return slides;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

/* ─── Stat Card ─── */
function StatCard({
  icon,
  label,
  value,
  sub,
  color = "text-white",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="pres-stat-card bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 flex flex-col items-center gap-2 min-w-[140px]">
      <span className="text-white/60">{icon}</span>
      <span className={`text-2xl sm:text-3xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-white/70 font-medium">{label}</span>
      {sub && <span className="text-[10px] text-white/50">{sub}</span>}
    </div>
  );
}

/* ─── Mini bar chart ─── */
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className={`pres-bar-fill h-full rounded-full ${color}`}
        data-pres-width={`${pct}%`}
        style={{ width: 0 }}
      />
    </div>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/* ─── Slide Components ─── */

function TitleSlide({ data }: { data: MonthlySummaryData }) {
  return (
    <div className="pres-slide-content flex flex-col items-center justify-center text-center h-full">
      {/* Decorative circles */}
      <div data-pres-float className="absolute top-20 left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
      <div data-pres-float className="absolute bottom-20 right-20 w-80 h-80 bg-fuchsia-500/10 rounded-full blur-3xl" />

      <div className="pres-anim-scale relative z-10">
        <div data-pres-float className="w-32 h-32 mx-auto mb-10 relative z-10 flex items-center justify-center">
          <FlhIconMark
            width={128}
            height={134}
            title="FLH Logo"
            className="h-full w-full filter drop-shadow-[0_0_35px_rgba(168,85,247,0.7)]"
          />
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
          Monthly Summary
        </h1>
        <p className="text-xl sm:text-2xl text-purple-200 font-light mb-2">
          {data.monthLabel}
        </p>
        <p className="text-sm text-white/40 mt-4">
          Future Leaders Hub — NGO Operations Report
        </p>
        <div data-pres-float className="mt-10 flex items-center gap-2 text-white/30 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          Press arrow keys or click Next to continue
        </div>
      </div>
    </div>
  );
}

function OverviewSlide({ data }: { data: MonthlySummaryData }) {
  return (
    <div className="pres-slide-content flex flex-col h-full px-4 sm:px-8 lg:px-16 py-6">
      <div className="pres-anim-fade-up">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">
          Overall Highlights
        </h2>
        <p className="text-sm text-white/50 mb-6">{data.monthLabel}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8 pres-anim-stagger">
        <StatCard
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          label="Team Members"
          value={data.totalMembers}
        />
        <StatCard
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          label="Active Projects"
          value={data.activeProjects}
          sub={`${data.completedProjects} completed`}
        />
        <StatCard
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          label="Events"
          value={data.totalEvents}
        />
        <StatCard
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          label="People Reached"
          value={data.totalPeopleReached.toLocaleString()}
        />
        <StatCard
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="Attendance"
          value={data.overallAttendanceRate != null ? `${data.overallAttendanceRate}%` : "N/A"}
        />
      </div>

      {/* Department breakdown bars */}
      <div className="flex-1 pres-anim-fade-up" style={{ animationDelay: "0.4s" }}>
        <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">Department Breakdown</p>
        <div className="space-y-3">
          {data.departments.map((dept) => {
            const deptColor = getDeptColor(dept.department);
            return (
              <div key={dept.department} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${deptColor.dot}`} />
                    <span className="text-sm font-semibold text-white">{dept.department}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/50">
                    <span>{dept.memberCount} members</span>
                    <span>{dept.activeProjects} projects</span>
                    <span>{dept.totalEvents} events</span>
                  </div>
                </div>
                <MiniBar value={dept.activeProjects + dept.completedProjects} max={Math.max(...data.departments.map(d => d.activeProjects + d.completedProjects), 1)} color={`bg-gradient-to-r ${deptColor.gradient}`} />
              </div>
            );
          })}
        </div>
      </div>

      {data.totalExpenses > 0 && (
        <div className="mt-4 text-right pres-anim-fade-up" style={{ animationDelay: "0.6s" }}>
          <span className="text-xs text-white/40">Total Expenses This Month: </span>
          <span className="text-lg font-bold text-white/80">${data.totalExpenses.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

function DeptIntroSlide({ dept }: { dept: DepartmentSummary }) {
  const colors = getDeptColor(dept.department);
  return (
    <div className={`pres-slide-content flex flex-col items-center justify-center text-center h-full`}>
      <div className="absolute inset-0 opacity-20">
        <div data-pres-float className={`absolute top-1/4 left-1/3 w-96 h-96 bg-gradient-to-br ${colors.gradient} rounded-full blur-3xl`} />
      </div>

      <div className="pres-anim-scale relative z-10">
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6 ${colors.badge}`}>
          <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <span className="text-sm font-semibold">Department Overview</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">{dept.department}</h2>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{dept.memberCount}</p>
            <p className="text-xs text-white/50">Members</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{dept.activeProjects}</p>
            <p className="text-xs text-white/50">Active Projects</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{dept.completedProjects}</p>
            <p className="text-xs text-white/50">Completed</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{dept.totalEvents}</p>
            <p className="text-xs text-white/50">Events</p>
          </div>
          {dept.attendanceRate != null && (
            <>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{dept.attendanceRate}%</p>
                <p className="text-xs text-white/50">Attendance</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DeptProjectsSlide({ dept }: { dept: DepartmentSummary }) {
  const colors = getDeptColor(dept.department);
  return (
    <div className="pres-slide-content flex flex-col h-full px-4 sm:px-8 lg:px-16 py-6">
      <div className="pres-anim-fade-up flex items-center gap-3 mb-6">
        <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
        <h2 className="text-2xl font-bold text-white">{dept.department}</h2>
        <span className="text-white/40">—</span>
        <span className="text-lg text-white/60">Projects</span>
      </div>

      <div className="flex-1 overflow-auto hide-scrollbar">
        <div className="grid gap-3 sm:grid-cols-2 pres-anim-stagger">
          {dept.projects.map((p) => {
            const st = STATUS_LABELS[p.status] || { label: p.status, color: "bg-slate-100 text-slate-600" };
            return (
              <div key={p.id} className="bg-white/8 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/12 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-white leading-tight">{p.name}</h3>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md ${st.color}`}>{st.label}</span>
                </div>
                {p.description && (
                  <p className="text-xs text-white/40 line-clamp-2 mb-3">{p.description}</p>
                )}
                {p.ownerNames.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.ownerNames.map((n, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10">{n}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DeptEventsSlide({ dept }: { dept: DepartmentSummary }) {
  const colors = getDeptColor(dept.department);
  return (
    <div className="pres-slide-content flex flex-col h-full px-4 sm:px-8 lg:px-16 py-6">
      <div className="pres-anim-fade-up flex items-center gap-3 mb-6">
        <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
        <h2 className="text-2xl font-bold text-white">{dept.department}</h2>
        <span className="text-white/40">—</span>
        <span className="text-lg text-white/60">Events</span>
      </div>

      <div className="flex-1 overflow-auto hide-scrollbar">
        <div className="space-y-3 pres-anim-stagger">
          {dept.events.map((e) => (
            <div key={e.id} className="bg-white/8 backdrop-blur-sm border border-white/10 rounded-xl p-4 flex items-start gap-4 hover:bg-white/12 transition-colors">
              <div className="shrink-0 w-14 h-14 bg-white/10 rounded-xl flex flex-col items-center justify-center border border-white/10">
                <span className="text-[10px] text-white/50 font-medium uppercase">
                  {(() => { try { return new Date(e.date).toLocaleDateString("en-US", { month: "short" }); } catch { return ""; } })()}
                </span>
                <span className="text-lg font-bold text-white leading-none">
                  {(() => { try { return new Date(e.date).getDate(); } catch { return ""; } })()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-0.5">{e.title}</h3>
                {e.location && <p className="text-xs text-white/40 mb-1">📍 {e.location}</p>}
                {e.description && <p className="text-xs text-white/30 line-clamp-2">{e.description}</p>}
                {e.ownerNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {e.ownerNames.map((n, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50 border border-white/10">{n}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeptImpactSlide({ dept }: { dept: DepartmentSummary }) {
  const colors = getDeptColor(dept.department);
  const totalReached = dept.impactRecords.reduce((s, r) => s + r.peopleReached, 0);
  return (
    <div className="pres-slide-content flex flex-col h-full px-4 sm:px-8 lg:px-16 py-6">
      <div className="pres-anim-fade-up flex items-center gap-3 mb-4">
        <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
        <h2 className="text-2xl font-bold text-white">{dept.department}</h2>
        <span className="text-white/40">—</span>
        <span className="text-lg text-white/60">Impact & Achievements</span>
      </div>

      <div className="pres-anim-fade-up mb-6 inline-flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 border border-white/10" style={{ animationDelay: "0.2s" }}>
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <span className="text-2xl font-bold text-white">{totalReached.toLocaleString()}</span>
        <span className="text-sm text-white/50">people reached</span>
      </div>

      <div className="flex-1 overflow-auto hide-scrollbar">
        <div className="space-y-2 pres-anim-stagger">
          {dept.impactRecords.map((ir) => (
            <div key={ir.id} className="bg-white/8 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/12 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="text-sm font-semibold text-white">{ir.projectName}</h3>
                <span className="text-xs text-emerald-400 font-bold shrink-0">{ir.peopleReached.toLocaleString()} reached</span>
              </div>
              <p className="text-xs text-white/40 mb-1">
                <span className="text-white/60 font-medium">{ir.activityType}</span> · {formatDate(ir.date)}
              </p>
              {ir.resultSummary && <p className="text-xs text-white/30">{ir.resultSummary}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function ClosingSlide({ data }: { data: MonthlySummaryData }) {
  return (
    <div className="pres-slide-content flex flex-col items-center justify-center text-center h-full">
      <div className="absolute inset-0 opacity-20">
        <div data-pres-float className="absolute top-1/3 left-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl" />
        <div data-pres-float className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-fuchsia-500/20 rounded-full blur-3xl" />
      </div>

      <div className="pres-anim-scale relative z-10">
        <div data-pres-float className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/30">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">Summary Complete</h2>
        <p className="text-lg text-white/50 mb-6">{data.monthLabel}</p>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-white/60 text-sm">
          <span><strong className="text-white">{data.totalProjects}</strong> Total Projects</span>
          <span>•</span>
          <span><strong className="text-white">{data.totalEvents}</strong> Events</span>
          <span>•</span>
          <span><strong className="text-white">{data.totalPeopleReached.toLocaleString()}</strong> People Reached</span>
          <span>•</span>
          <span><strong className="text-white">{data.departments.length}</strong> Departments</span>
        </div>

        <p className="mt-10 text-xs text-white/30">
          Thank you for your hard work and dedication 🎉
        </p>
      </div>
    </div>
  );
}

/* ─── Main Presentation Component ─── */

export default function MonthlySummaryPresentation({
  data,
  onExit,
}: {
  data: MonthlySummaryData;
  onExit: () => void;
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animKey, setAnimKey] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const presentationRef = useRef<HTMLDivElement | null>(null);
  const slideRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const slides = buildSlides(data);
  const total = slides.length;

  const goTo = useCallback(
    (idx: number, dir: "next" | "prev") => {
      if (idx < 0 || idx >= total || idx === currentSlide) return;
      setDirection(dir);
      setAnimKey((k) => k + 1);
      setCurrentSlide(idx);
    },
    [currentSlide, total]
  );

  const next = useCallback(() => goTo(currentSlide + 1, "next"), [currentSlide, goTo]);
  const prev = useCallback(() => goTo(currentSlide - 1, "prev"), [currentSlide, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, onExit]);

  const slide = slides[currentSlide];
  const progress = ((currentSlide + 1) / total) * 100;

  useEffect(() => {
    const presentationElement = presentationRef.current;
    if (!presentationElement) return;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set("[data-pres-chrome]", { clearProps: "all" });
        return;
      }

      gsap.fromTo(
        "[data-pres-chrome]",
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.08,
          ease: "power3.out",
        }
      );
    }, presentationElement);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  useEffect(() => {
    const presentationElement = presentationRef.current;
    if (!presentationElement) return;

    const ctx = gsap.context(() => {
      const orbs = gsap.utils.toArray<HTMLElement>("[data-pres-ambient]");
      const sheen = gsap.utils.toArray<HTMLElement>("[data-pres-grid]");

      if (prefersReducedMotion) {
        gsap.set(orbs, { clearProps: "transform" });
        gsap.set(sheen, { opacity: 0.12 });
        return;
      }

      orbs.forEach((orb, index) => {
        gsap.to(orb, {
          keyframes: [
            {
              x: index % 2 === 0 ? 28 : -24,
              y: index === 1 ? -22 : 20,
              scale: 1.06,
              rotation: index % 2 === 0 ? -5 : 5,
              duration: 7 + index,
              ease: "sine.inOut",
            },
            {
              x: index % 2 === 0 ? -20 : 26,
              y: index === 1 ? 18 : -20,
              scale: 0.96,
              rotation: index % 2 === 0 ? 4 : -4,
              duration: 8 + index,
              ease: "sine.inOut",
            },
          ],
          repeat: -1,
          yoyo: true,
        });
      });

      gsap.to(sheen, {
        opacity: 0.2,
        duration: 4.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, presentationElement);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!progressBarRef.current) return;

    if (prefersReducedMotion) {
      gsap.set(progressBarRef.current, { width: `${progress}%` });
      return;
    }

    gsap.to(progressBarRef.current, {
      width: `${progress}%`,
      duration: 0.9,
      ease: "expo.out",
    });
  }, [prefersReducedMotion, progress]);

  useEffect(() => {
    const presentationElement = presentationRef.current;
    if (!presentationElement) return;

    const ctx = gsap.context(() => {
      const dots = gsap.utils.toArray<HTMLElement>("[data-pres-dot]");
      if (dots.length === 0) return;

      if (prefersReducedMotion) {
        gsap.set(dots, { clearProps: "transform,boxShadow" });
        return;
      }

      gsap.fromTo(
        dots[currentSlide],
        {
          scale: 0.82,
          boxShadow: "0 0 0 rgba(217,70,239,0)",
        },
        {
          scale: 1,
          boxShadow: "0 0 18px rgba(217,70,239,0.28)",
          duration: 0.55,
          ease: "back.out(2)",
        }
      );
    }, presentationElement);

    return () => ctx.revert();
  }, [currentSlide, prefersReducedMotion]);

  useEffect(() => {
    const slideElement = slideRef.current;
    if (!slideElement) return;

    const ctx = gsap.context(() => {
      const staggeredItems = gsap.utils.toArray<HTMLElement>(".pres-anim-stagger > *");
      const bars = gsap.utils.toArray<HTMLElement>(".pres-bar-fill");
      const floaters = gsap.utils.toArray<HTMLElement>("[data-pres-float]");

      if (prefersReducedMotion) {
        gsap.set(slideElement, { clearProps: "all" });
        gsap.set(
          [".pres-anim-scale", ".pres-anim-fade-up", staggeredItems, floaters],
          { clearProps: "all" }
        );
        bars.forEach((bar) => {
          gsap.set(bar, { width: bar.dataset.presWidth ?? "0%" });
        });
        return;
      }

      const slideOffset = direction === "next" ? 72 : -72;
      const rotateAxis = direction === "next" ? -4 : 4;
      const timeline = gsap.timeline({
        defaults: { ease: "power3.out" },
      });

      gsap.set(slideElement, { transformPerspective: 1200 });
      gsap.set(bars, { width: 0 });

      timeline.fromTo(
        slideElement,
        {
          autoAlpha: 0,
          x: slideOffset,
          rotateY: rotateAxis,
          scale: 0.985,
          filter: "blur(10px)",
        },
        {
          autoAlpha: 1,
          x: 0,
          rotateY: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.95,
          ease: "expo.out",
        }
      );

      timeline.fromTo(
        ".pres-anim-scale",
        {
          autoAlpha: 0,
          y: 38,
          scale: 0.92,
          filter: "blur(12px)",
        },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.95,
          stagger: 0.08,
          ease: "expo.out",
        },
        "-=0.68"
      );

      timeline.fromTo(
        ".pres-anim-fade-up",
        {
          autoAlpha: 0,
          y: 28,
          filter: "blur(10px)",
        },
        {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.72,
          stagger: 0.08,
        },
        "-=0.72"
      );

      if (staggeredItems.length > 0) {
        timeline.fromTo(
          staggeredItems,
          {
            autoAlpha: 0,
            y: 32,
            scale: 0.97,
            filter: "blur(10px)",
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 0.8,
            stagger: 0.06,
          },
          "-=0.52"
        );
      }

      if (bars.length > 0) {
        timeline.to(
          bars,
          {
            width: (_index, target) => (target as HTMLElement).dataset.presWidth ?? "0%",
            duration: 1,
            stagger: 0.08,
            ease: "expo.out",
          },
          "-=0.68"
        );
      }

      floaters.forEach((floater, index) => {
        gsap.to(floater, {
          y: index % 2 === 0 ? -14 : 14,
          x: index % 2 === 0 ? 8 : -8,
          duration: 3.8 + index * 0.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    }, slideElement);

    return () => ctx.revert();
  }, [animKey, direction, prefersReducedMotion]);

  function renderSlide() {
    switch (slide.kind) {
      case "title":
        return <TitleSlide data={data} />;
      case "overview":
        return <OverviewSlide data={data} />;
      case "department-intro":
        return <DeptIntroSlide dept={slide.dept} />;
      case "department-projects":
        return <DeptProjectsSlide dept={slide.dept} />;
      case "department-events":
        return <DeptEventsSlide dept={slide.dept} />;
      case "department-impact":
        return <DeptImpactSlide dept={slide.dept} />;
      case "closing":
        return <ClosingSlide data={data} />;
    }
  }

  return (
    <div
      ref={presentationRef}
      className="pres-fullscreen fixed inset-0 z-[100] bg-slate-950 flex flex-col overflow-hidden select-none"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_34%)] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/40 pointer-events-none" />
      <div
        data-pres-grid
        className="absolute inset-0 pointer-events-none opacity-10 [background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:120px_120px] [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]"
      />
      <div data-pres-ambient className="pres-ambient-orb pointer-events-none absolute -top-24 left-[6%] h-80 w-80 rounded-full bg-fuchsia-500/14 blur-3xl" />
      <div data-pres-ambient className="pres-ambient-orb pointer-events-none absolute bottom-[-8rem] right-[8%] h-[26rem] w-[26rem] rounded-full bg-violet-500/14 blur-3xl" />
      <div data-pres-ambient className="pres-ambient-orb pointer-events-none absolute top-1/3 left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 z-20">
        <div
          ref={progressBarRef}
          className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-400"
          style={{ width: 0 }}
        />
      </div>

      {/* Top bar */}
      <div data-pres-chrome className="absolute top-3 left-4 right-4 flex items-center justify-between z-20">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Exit (Esc)
        </button>

        <span className="text-xs text-white/30 font-medium">
          {currentSlide + 1} / {total}
        </span>
      </div>

      {/* Slide content */}
      <div
        key={animKey}
        ref={slideRef}
        className="pres-slide-shell flex-1 relative z-10 pt-14 pb-16"
      >
        {renderSlide()}
      </div>

      {/* Bottom navigation */}
      <div data-pres-chrome className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-20">
        <button
          onClick={prev}
          disabled={currentSlide === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        {/* Slide indicator dots */}
        <div className="hidden sm:flex items-center gap-1.5 max-w-xs overflow-hidden">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx, idx > currentSlide ? "next" : "prev")}
              data-pres-dot
              className={`shrink-0 rounded-full transition-all duration-300 ${
                idx === currentSlide
                  ? "w-6 h-2 bg-purple-400"
                  : "w-2 h-2 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>

        <button
          onClick={currentSlide === total - 1 ? onExit : next}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            currentSlide === total - 1
              ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/20"
              : "bg-white/5 hover:bg-white/10 border border-white/10 text-white/60"
          }`}
        >
          {currentSlide === total - 1 ? "Finish" : "Next"}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
