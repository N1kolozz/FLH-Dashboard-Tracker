"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { getEvents, createEvent, updateEvent, deleteEvent } from "@/app/actions/events";
import type { EventRow } from "@/app/actions/events";
import { getMembers } from "@/app/actions/members";
import MemberAvatarStack from "@/components/MemberAvatarStack";
import MemberMultiSelect, { type MemberChoice } from "@/components/MemberMultiSelect";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { getCurrentSession } from "@/app/actions/session";
import type { Session } from "@/lib/auth";
import {
  type PublicHoliday,
  buildHolidaysByDate,
  fetchPublicHolidaysWithStatus,
  holidayChipClass,
  holidayLabel,
} from "@/lib/public-holidays";
import {
  getDateFromISO,
  getLocalISODate,
  getWeekDays,
  shiftISODate,
} from "@/lib/calendar-ui";

/* ─── Types ─── */
type Department = "all" | "pr" | "logistics" | "projects" | "other";
type CalendarView = "month" | "week";
type CalendarLayout = "slide" | "fit";

interface CalEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  department: Department;
  description: string;
  ownerUserIds: number[];
  createdAt: string;
}

const DEPT_CONFIG: Record<Department, { label: string; color: string; dot: string }> = {
  all: { label: "All Departments", color: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  pr: { label: "PR & Social", color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  logistics: { label: "Logistics", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  projects: { label: "Projects", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  other: { label: "Other", color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};
const DEPT_SHORT_LABEL: Record<Department, string> = {
  all: "ALL",
  pr: "PR",
  logistics: "LOG",
  projects: "PRO",
  other: "OTH",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMPTY: CalEvent = {
  id: 0,
  title: "",
  date: "",
  time: "",
  endTime: "",
  location: "",
  department: "other",
  description: "",
  ownerUserIds: [],
  createdAt: "",
};

function rowToEvent(row: EventRow): CalEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time,
    endTime: row.end_time,
    location: row.location,
    department: row.department as Department,
    description: row.description,
    ownerUserIds: (row.owner_user_ids || []).map(Number),
    createdAt: row.created_at,
  };
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay() - 1; // Monday = 0
  if (startDow < 0) startDow = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function LoadingStatCards() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="animate-pulse rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
          <div className="h-3 w-20 rounded-full bg-slate-200" />
          <div className="mt-3 h-9 w-16 rounded-2xl bg-slate-200" />
          <div className="mt-2 h-4 w-32 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function CalendarDataSkeleton({
  calendarView,
  isFitLayout,
}: {
  calendarView: CalendarView;
  isFitLayout: boolean;
}) {
  const isMonthView = calendarView === "month";
  const containerClassName = isMonthView
    ? (isFitLayout ? "w-full" : "min-w-[940px]")
    : (isFitLayout ? "w-full" : "min-w-[1180px]");
  const cellClassName = isMonthView
    ? (isFitLayout ? "min-h-[82px] sm:min-h-[108px]" : "min-h-[150px]")
    : (isFitLayout ? "min-h-[150px] sm:min-h-[200px]" : "min-h-[280px]");
  const cellCount = isMonthView ? 35 : 7;

  return (
    <div className={isFitLayout ? "" : "overflow-x-auto pb-1"}>
      <div className={`${containerClassName} overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50 shadow-sm`}>
        <div className="grid grid-cols-7 border-b border-slate-200/80 bg-slate-100/90">
          {WEEKDAYS.map((day) => (
            <div key={day} className={`${isFitLayout ? "px-1 py-2 sm:px-2" : "px-4 py-3"} text-center`}>
              <div className="mx-auto h-3 w-10 animate-pulse rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: cellCount }).map((_, idx) => (
            <div
              key={idx}
              className={`${cellClassName} animate-pulse border-b border-r border-slate-200/70 bg-white px-3 py-3`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="h-8 w-8 rounded-2xl bg-slate-200" />
                <div className="space-y-1">
                  <div className="h-3 w-10 rounded-full bg-slate-100" />
                  <div className="h-3 w-8 rounded-full bg-slate-100" />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-8 rounded-xl bg-slate-100" />
                <div className="h-8 rounded-xl bg-slate-100/80" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div
          key={idx}
          className="flex animate-pulse items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm"
        >
          <div className="w-14 shrink-0 space-y-2 text-center">
            <div className="mx-auto h-8 w-8 rounded-2xl bg-slate-200" />
            <div className="mx-auto h-3 w-8 rounded-full bg-slate-100" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-40 rounded-full bg-slate-200" />
            <div className="h-3 w-56 rounded-full bg-slate-100" />
            <div className="h-3 w-32 rounded-full bg-slate-100" />
          </div>
          <div className="h-6 w-28 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [members, setMembers] = useState<MemberChoice[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalEvent>(EMPTY);
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [calendarCursor, setCalendarCursor] = useState(() => getLocalISODate());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [calendarLayout, setCalendarLayout] = useState<CalendarLayout>("slide");
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const holidaysCacheRef = useRef<Record<number, PublicHoliday[]>>({});
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    async function init() {
      setIsLoadingData(true);
      try {
        const [sess, eventRes, memberRes] = await Promise.all([
          getCurrentSession(),
          getEvents(),
          getMembers(),
        ]);
        setSession(sess);
        if (eventRes.success && eventRes.events) {
          setEvents(eventRes.events.map(rowToEvent));
        }
        if (memberRes.success && memberRes.members) {
          const nextMembers = (memberRes.members as { id: number; name: string }[])
            .map((member) => ({ id: member.id, name: member.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setMembers(nextMembers);
        }
      } finally {
        setIsLoadingData(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = holidaysCacheRef.current[viewYear];
    if (cached) {
      setPublicHolidays(cached);
    }
    fetchPublicHolidaysWithStatus(viewYear).then(({ holidays, ok }) => {
      if (cancelled) return;
      if (ok) {
        holidaysCacheRef.current[viewYear] = holidays;
        setPublicHolidays(holidays);
      } else if (!cached) {
        setPublicHolidays([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [viewYear]);

  const holidaysByDate = useMemo(() => buildHolidaysByDate(publicHolidays), [publicHolidays]);

  const refreshEvents = async () => {
    setIsLoadingData(true);
    try {
      const res = await getEvents();
      if (res.success && res.events) {
        setEvents(res.events.map(rowToEvent));
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  const saveEvent = async () => {
    if (!editing.title.trim() || !editing.date) return;
    if (editing.id) {
      await updateEvent(editing.id, {
        title: editing.title,
        date: editing.date,
        time: editing.time,
        endTime: editing.endTime,
        location: editing.location,
        department: editing.department,
        description: editing.description,
        ownerUserIds: editing.ownerUserIds,
      });
    } else {
      await createEvent({
        title: editing.title,
        date: editing.date,
        time: editing.time,
        endTime: editing.endTime,
        location: editing.location,
        department: editing.department,
        description: editing.description,
        ownerUserIds: editing.ownerUserIds,
      });
    }
    await refreshEvents();
    setModalOpen(false);
    setEditing(EMPTY);
  };

  const handleDelete = async (id: number) => {
    await deleteEvent(id);
    await refreshEvents();
  };

  const openNew = (date?: string) => {
    setEditing({
      ...EMPTY,
      date: date || "",
      ownerUserIds: session?.userId ? [Number(session.userId)] : [],
    });
    setModalOpen(true);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };
  const goToToday = () => {
    const now = new Date();
    const todayIso = getLocalISODate(now);
    setViewMonth(now.getMonth());
    setViewYear(now.getFullYear());
    setCalendarCursor(todayIso);
    setSelectedDate((current) => (current ? todayIso : current));
  };
  const selectDate = (dateStr: string) => {
    setCalendarCursor(dateStr);
    setSelectedDate((current) => (current === dateStr ? null : dateStr));
  };

  const cells = getMonthDays(viewYear, viewMonth);
  const today = getLocalISODate();
  const currentMonthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
  const fallbackWeekAnchor =
    today.startsWith(currentMonthKey) ? today : `${currentMonthKey}-01`;
  const weekAnchorIso = calendarCursor || fallbackWeekAnchor;
  const weekDates = getWeekDays(getDateFromISO(weekAnchorIso));

  const eventsForDate = (dateStr: string) => events.filter((e) => e.date === dateStr);
  const getOwnerMembers = (ownerUserIds: number[]) =>
    members.filter((member) => ownerUserIds.includes(member.id));

  const monthEvents = events.filter((e) => e.date.startsWith(currentMonthKey));
  const activeDaysCount = new Set(monthEvents.map((e) => e.date)).size;
  const departmentCount = new Set(monthEvents.map((e) => e.department)).size;
  const upcomingEvents = [...events]
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 20);
  const selectedDayEvents = selectedDate
    ? [...eventsForDate(selectedDate)].sort((a, b) => a.time.localeCompare(b.time))
    : [];
  const selectedDayHolidays = selectedDate
    ? holidaysByDate.get(selectedDate) ?? []
    : [];
  const monthLabel = `${MONTHS[viewMonth]} ${viewYear}`;
  const isFitLayout = calendarLayout === "fit";
  const weekLabel = weekDates.length > 0
    ? `${weekDates[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${weekDates[6].toLocaleDateString(undefined, {
        month: weekDates[0].getMonth() === weekDates[6].getMonth() ? undefined : "short",
        day: "numeric",
        year: weekDates[0].getFullYear() === weekDates[6].getFullYear() ? undefined : "numeric",
      })}`
    : monthLabel;
  const selectedDayLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  const navigateCalendar = (direction: "prev" | "next") => {
    if (calendarView === "week") {
      const nextIso = shiftISODate(weekAnchorIso, direction === "next" ? 7 : -7);
      const nextDate = getDateFromISO(nextIso);
      setCalendarCursor(nextIso);
      setViewMonth(nextDate.getMonth());
      setViewYear(nextDate.getFullYear());
      return;
    }

    if (direction === "next") {
      nextMonth();
    } else {
      prevMonth();
    }
  };

  const canEdit = session && (
    session.role === "ADMIN" || 
    session.role === "HEAD" || 
    session.department === "Management"
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-purple-200/70 bg-gradient-to-r from-amber-50/70 via-orange-50/65 to-yellow-50/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Events
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isLoadingData ? "Loading events..." : `${events.length} event${events.length !== 1 ? "s" : ""} · ${upcomingEvents.length} upcoming`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              <button onClick={() => setView("calendar")} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === "calendar" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Calendar</button>
              <button onClick={() => { setView("list"); setSelectedDate(null); }} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === "list" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>List</button>
            </div>
            {canEdit && (
              <button
                onClick={() => openNew()}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                + New Event
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {isLoadingData && view === "list" ? (
          <EventListSkeleton />
        ) : events.length === 0 && view === "list" ? (
          <EmptyState
            title="No events yet"
            description="Create your first event to start organizing your calendar."
            icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            action={{ label: "Create Event", onClick: () => openNew() }}
          />
        ) : view === "calendar" ? (
          <div className="space-y-5">
            {isLoadingData ? (
              <LoadingStatCards />
            ) : (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">This Month</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{monthEvents.length}</p>
                  <p className="mt-1 text-sm text-slate-500">Events scheduled in {MONTHS[viewMonth]}</p>
                </div>
                <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-white to-amber-50/70 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">Upcoming</p>
                  <p className="mt-3 text-3xl font-semibold text-amber-600">{upcomingEvents.length}</p>
                  <p className="mt-1 text-sm text-slate-500">Next events ready to track</p>
                </div>
                <div className="rounded-2xl border border-blue-200/70 bg-gradient-to-br from-white to-blue-50/70 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Active Days</p>
                  <p className="mt-3 text-3xl font-semibold text-blue-600">{activeDaysCount}</p>
                  <p className="mt-1 text-sm text-slate-500">Days with at least one event</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-white to-emerald-50/70 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-500">Departments</p>
                  <p className="mt-3 text-3xl font-semibold text-emerald-600">{departmentCount}</p>
                  <p className="mt-1 text-sm text-slate-500">Teams represented this month</p>
                </div>
              </div>
            )}

            <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-500">
                    {calendarView === "month" ? "Month View" : "Week View"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
                    {calendarView === "month" ? monthLabel : weekLabel}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Switch between month and week, then choose either a roomy slide layout or a zoomed-out fit layout.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-2xl bg-slate-100 p-1 text-sm">
                    <button
                      onClick={() => setCalendarView("month")}
                      className={`rounded-xl px-4 py-2 font-medium transition-colors ${
                        calendarView === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      Month
                    </button>
                    <button
                      onClick={() => {
                        setCalendarCursor(selectedDate ?? fallbackWeekAnchor);
                        setCalendarView("week");
                      }}
                      className={`rounded-xl px-4 py-2 font-medium transition-colors ${
                        calendarView === "week" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      Week
                    </button>
                  </div>
                  <div className="flex rounded-2xl bg-slate-100 p-1 text-sm">
                    <button
                      onClick={() => setCalendarLayout("slide")}
                      className={`rounded-xl px-4 py-2 font-medium transition-colors ${
                        calendarLayout === "slide" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      Slide
                    </button>
                    <button
                      onClick={() => setCalendarLayout("fit")}
                      className={`rounded-xl px-4 py-2 font-medium transition-colors ${
                        calendarLayout === "fit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      Fit
                    </button>
                  </div>
                  <div className="flex flex-nowrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1">
                    <button onClick={() => navigateCalendar("prev")} className="whitespace-nowrap rounded-xl border border-transparent bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100">
                      ← Prev
                    </button>
                    <button onClick={goToToday} className="whitespace-nowrap rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100">
                      Today
                    </button>
                    <button onClick={() => navigateCalendar("next")} className="whitespace-nowrap rounded-xl border border-transparent bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100">
                      Next →
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                {(Object.keys(DEPT_CONFIG) as Department[]).map((dept) => (
                  <span
                    key={dept}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-medium ${DEPT_CONFIG[dept].color}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${DEPT_CONFIG[dept].dot}`} />
                    {DEPT_CONFIG[dept].label}
                  </span>
                ))}
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-medium text-amber-700">
                  Public holidays
                </span>
              </div>
            </div>

            {isLoadingData ? (
              <CalendarDataSkeleton calendarView={calendarView} isFitLayout={isFitLayout} />
            ) : calendarView === "month" ? (
              <div className={isFitLayout ? "" : "overflow-x-auto pb-1"}>
                <div className={`${isFitLayout ? "w-full" : "min-w-[940px]"} overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50 shadow-sm`}>
                  <div className="grid grid-cols-7 border-b border-slate-200/80 bg-slate-100/90">
                    {WEEKDAYS.map((d) => (
                      <div key={d} className={`${isFitLayout ? "px-1 py-2 text-[9px] sm:px-2" : "px-4 py-3 text-[11px]"} text-center font-semibold uppercase tracking-[0.24em] text-slate-500`}>
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {cells.map((day, idx) => {
                      const isWeekend = idx % 7 >= 5;
                      if (day === null) {
                        return (
                          <div
                            key={idx}
                            className={`${isFitLayout ? "min-h-[82px] sm:min-h-[108px]" : "min-h-[150px]"} border-b border-r border-slate-200/70 ${
                              isWeekend ? "bg-slate-100/70" : "bg-slate-50/50"
                            }`}
                          />
                        );
                      }

                      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const dayEvents = eventsForDate(dateStr);
                      const dayHolidays = holidaysByDate.get(dateStr) ?? [];
                      const eventSlots = isFitLayout ? 2 : Math.max(1, 3 - Math.min(dayHolidays.length, 2) - (dayHolidays.length > 2 ? 1 : 0));
                      const isToday = dateStr === today;
                      const isSelected = dateStr === selectedDate;

                      return (
                        <div
                          key={idx}
                          onClick={() => selectDate(dateStr)}
                          className={`${isFitLayout ? "min-h-[82px] px-1 py-1.5 sm:min-h-[108px] sm:px-1.5 sm:py-2" : "min-h-[150px] px-3 py-3"} cursor-pointer border-b border-r border-slate-200/70 transition-all duration-200 ${
                            isSelected
                              ? "bg-amber-50/80"
                              : isWeekend
                                ? "bg-slate-50/75 hover:bg-amber-50/50"
                                : "bg-white hover:bg-amber-50/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div
                              className={`flex items-center justify-center font-semibold ring-1 ring-inset ${
                                isFitLayout ? "h-6 w-6 rounded-xl text-[10px] sm:h-7 sm:w-7 sm:text-xs" : "h-9 w-9 rounded-2xl text-sm"
                              } ${
                                isToday
                                  ? "bg-amber-500 text-white ring-amber-500"
                                  : isSelected
                                    ? "bg-amber-100 text-amber-700 ring-amber-200"
                                    : "bg-white text-slate-700 ring-slate-200"
                              }`}
                            >
                              {day}
                            </div>
                            <div className={`flex flex-col items-end ${isFitLayout ? "gap-0.5" : "gap-1"}`}>
                              {dayHolidays.length > 0 && (
                                <span className={`${isFitLayout ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"} rounded-full bg-amber-50 font-semibold text-amber-700`}>
                                  {isFitLayout ? `H${dayHolidays.length}` : `${dayHolidays.length} holiday${dayHolidays.length === 1 ? "" : "s"}`}
                                </span>
                              )}
                              {dayEvents.length > 0 && (
                                <span className={`${isFitLayout ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"} rounded-full bg-slate-100 font-semibold text-slate-600`}>
                                  {isFitLayout ? `E${dayEvents.length}` : `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
                                </span>
                              )}
                            </div>
                          </div>

                          {isFitLayout ? (
                            <div className="mt-1.5 space-y-1 sm:mt-2">
                              {dayEvents.slice(0, eventSlots).map((ev) => (
                                <div
                                  key={ev.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCalendarCursor(dateStr);
                                    setSelectedDate(dateStr);
                                    setEditing(ev);
                                    setModalOpen(true);
                                  }}
                                  className={`rounded-md border px-1 py-0.5 text-[9px] font-semibold sm:px-1.5 ${DEPT_CONFIG[ev.department].color}`}
                                  title={ev.title}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="truncate">{DEPT_SHORT_LABEL[ev.department]}</span>
                                    {ev.time && <span className="shrink-0 opacity-70">{ev.time}</span>}
                                  </div>
                                </div>
                              ))}
                              {dayEvents.length > eventSlots && (
                                <p className="px-0.5 text-[9px] font-semibold text-slate-400 sm:text-[10px]">
                                  +{dayEvents.length - eventSlots}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="mt-3 space-y-1.5">
                              {dayHolidays.slice(0, 2).map((h, hi) => (
                                <div key={`${h.date}-${hi}`} className={holidayChipClass} title={h.name}>
                                  {holidayLabel(h)}
                                </div>
                              ))}
                              {dayHolidays.length > 2 && (
                                <p className="px-1 text-[11px] font-medium text-slate-400">
                                  +{dayHolidays.length - 2} more holidays
                                </p>
                              )}
                              {dayEvents.slice(0, eventSlots).map((ev) => (
                                <div
                                  key={ev.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCalendarCursor(dateStr);
                                    setSelectedDate(dateStr);
                                    setEditing(ev);
                                    setModalOpen(true);
                                  }}
                                  className={`rounded-xl border px-2.5 py-2 text-[11px] font-medium transition-transform hover:-translate-y-0.5 ${DEPT_CONFIG[ev.department].color}`}
                                  title={ev.title}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate">{DEPT_CONFIG[ev.department].label}</span>
                                    {ev.time && <span className="shrink-0 text-[10px] opacity-75">{ev.time}</span>}
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug opacity-90">
                                    {ev.title}
                                  </p>
                                </div>
                              ))}
                              {dayEvents.length > eventSlots && (
                                <p className="px-1 text-[11px] font-medium text-slate-400">
                                  +{dayEvents.length - eventSlots} more events
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className={isFitLayout ? "" : "overflow-x-auto pb-1"}>
                <div className={`${isFitLayout ? "w-full" : "min-w-[1180px]"} overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50 shadow-sm`}>
                  <div className="grid grid-cols-7 border-b border-slate-200/80 bg-slate-100/90">
                    {weekDates.map((date) => {
                      const dateStr = getLocalISODate(date);
                      const isToday = dateStr === today;
                      return (
                        <div key={dateStr} className={`${isFitLayout ? "px-1 py-2 sm:px-2" : "px-4 py-3"} text-center`}>
                          <p className={`${isFitLayout ? "text-[9px]" : "text-[11px]"} font-semibold uppercase tracking-[0.24em] text-slate-500`}>
                            {date.toLocaleDateString(undefined, { weekday: "short" })}
                          </p>
                          <p className={`mt-1 ${isFitLayout ? "text-[10px] sm:text-xs" : "text-sm"} font-semibold ${isToday ? "text-amber-700" : "text-slate-800"}`}>
                            {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-7">
                    {weekDates.map((date, idx) => {
                      const dateStr = getLocalISODate(date);
                      const dayEvents = eventsForDate(dateStr);
                      const dayHolidays = holidaysByDate.get(dateStr) ?? [];
                      const eventSlots = isFitLayout ? 2 : Math.max(2, 5 - Math.min(dayHolidays.length, 2) - (dayHolidays.length > 2 ? 1 : 0));
                      const isToday = dateStr === today;
                      const isSelected = dateStr === selectedDate;
                      const isCurrentMonth = date.getMonth() === viewMonth;
                      const isWeekend = idx >= 5;

                      return (
                        <div
                          key={dateStr}
                          onClick={() => selectDate(dateStr)}
                          className={`${isFitLayout ? "min-h-[150px] px-1 py-1.5 sm:min-h-[200px] sm:px-1.5 sm:py-2" : "min-h-[280px] px-3 py-3"} cursor-pointer border-r border-slate-200/70 transition-all duration-200 ${
                            isSelected
                              ? "bg-amber-50/80"
                              : !isCurrentMonth
                                ? "bg-slate-50/70 hover:bg-amber-50/40"
                                : isWeekend
                                  ? "bg-slate-50/60 hover:bg-amber-50/40"
                                  : "bg-white hover:bg-amber-50/30"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <div
                                className={`inline-flex items-center justify-center font-semibold ring-1 ring-inset ${
                                  isFitLayout ? "h-6 min-w-6 rounded-xl px-2 text-[10px] sm:h-7 sm:min-w-7 sm:text-xs" : "h-9 min-w-9 rounded-2xl px-3 text-sm"
                                } ${
                                  isToday
                                    ? "bg-amber-500 text-white ring-amber-500"
                                    : isSelected
                                      ? "bg-amber-100 text-amber-700 ring-amber-200"
                                      : "bg-white text-slate-700 ring-slate-200"
                                }`}
                              >
                                {date.getDate()}
                              </div>
                              <p className={`mt-2 ${isFitLayout ? "text-[9px] sm:text-[10px]" : "text-xs"} ${isCurrentMonth ? "text-slate-500" : "text-slate-400"}`}>
                                {isCurrentMonth ? (isFitLayout ? "This mo." : "Current month") : (isFitLayout ? "Other mo." : "Outside month")}
                              </p>
                            </div>
                            <div className={`flex flex-col items-end ${isFitLayout ? "gap-0.5" : "gap-1"}`}>
                              {dayHolidays.length > 0 && (
                                <span className={`${isFitLayout ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"} rounded-full bg-amber-50 font-semibold text-amber-700`}>
                                  {isFitLayout ? `H${dayHolidays.length}` : `${dayHolidays.length} holiday${dayHolidays.length === 1 ? "" : "s"}`}
                                </span>
                              )}
                              {dayEvents.length > 0 && (
                                <span className={`${isFitLayout ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"} rounded-full bg-slate-100 font-semibold text-slate-600`}>
                                  {isFitLayout ? `E${dayEvents.length}` : `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
                                </span>
                              )}
                            </div>
                          </div>

                          {isFitLayout ? (
                            <div className="mt-1.5 space-y-1 sm:mt-2">
                              {dayEvents.slice(0, eventSlots).map((ev) => (
                                <div
                                  key={ev.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCalendarCursor(dateStr);
                                    setSelectedDate(dateStr);
                                    setEditing(ev);
                                    setModalOpen(true);
                                  }}
                                  className={`rounded-md border px-1 py-0.5 text-[9px] font-semibold sm:px-1.5 ${DEPT_CONFIG[ev.department].color}`}
                                  title={ev.title}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="truncate">{DEPT_SHORT_LABEL[ev.department]}</span>
                                    {ev.time && <span className="shrink-0 opacity-70">{ev.time}</span>}
                                  </div>
                                </div>
                              ))}
                              {dayEvents.length > eventSlots && (
                                <p className="px-0.5 text-[9px] font-semibold text-slate-400 sm:text-[10px]">
                                  +{dayEvents.length - eventSlots}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="mt-3 space-y-2">
                              {dayHolidays.slice(0, 2).map((h, hi) => (
                                <div key={`${h.date}-${hi}`} className={holidayChipClass} title={h.name}>
                                  {holidayLabel(h)}
                                </div>
                              ))}
                              {dayHolidays.length > 2 && (
                                <p className="px-1 text-[11px] font-medium text-slate-400">
                                  +{dayHolidays.length - 2} more holidays
                                </p>
                              )}
                              {dayEvents.slice(0, eventSlots).map((ev) => (
                                <div
                                  key={ev.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCalendarCursor(dateStr);
                                    setSelectedDate(dateStr);
                                    setEditing(ev);
                                    setModalOpen(true);
                                  }}
                                  className={`rounded-xl border px-3 py-2.5 text-[11px] font-medium transition-transform hover:-translate-y-0.5 ${DEPT_CONFIG[ev.department].color}`}
                                  title={ev.title}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate">{DEPT_CONFIG[ev.department].label}</span>
                                    {ev.time && <span className="shrink-0 text-[10px] opacity-75">{ev.time}</span>}
                                  </div>
                                  <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug opacity-90">
                                    {ev.title}
                                  </p>
                                </div>
                              ))}
                              {dayEvents.length > eventSlots && (
                                <p className="px-1 text-[11px] font-medium text-slate-400">
                                  +{dayEvents.length - eventSlots} more events
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* List view */
          <div className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No upcoming events.</p>
            ) : (
              upcomingEvents.map((ev) => {
                const owners = getOwnerMembers(ev.ownerUserIds);

                return (
                  <div
                    key={ev.id}
                    onClick={() => { setEditing(ev); setModalOpen(true); }}
                    className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition-colors hover:bg-amber-50/40 cursor-pointer"
                  >
                    <div className="text-center shrink-0 w-14">
                      <p className="text-2xl font-bold text-slate-900">{new Date(ev.date + "T00:00:00").getDate()}</p>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">{MONTHS[new Date(ev.date + "T00:00:00").getMonth()].slice(0, 3)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{ev.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ev.time && `${ev.time}${ev.endTime ? ` – ${ev.endTime}` : ""}`}
                        {ev.location && ` · 📍 ${ev.location}`}
                      </p>
                      {owners.length > 0 && (
                        <div className="mt-1 flex items-center gap-2">
                          <MemberAvatarStack
                            names={owners.map((owner) => owner.name)}
                            size="sm"
                          />
                          <p className="text-xs text-slate-400 truncate">
                            {owners.map((owner) => owner.name).join(", ")}
                          </p>
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${DEPT_CONFIG[ev.department].color}`}>
                      {DEPT_CONFIG[ev.department].label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {view === "calendar" && selectedDate && (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="Close day details"
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
            onClick={() => setSelectedDate(null)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">Day Details</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{selectedDayLabel}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {selectedDayEvents.length} planned
                  </span>
                  {selectedDayHolidays.length > 0 && (
                    <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                      {selectedDayHolidays.length} holiday{selectedDayHolidays.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="mb-4 flex items-center justify-between">
                {canEdit ? (
                  <button
                    onClick={() => openNew(selectedDate)}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
                  >
                    + Add event
                  </button>
                ) : (
                  <div />
                )}
              </div>

              {selectedDayHolidays.length > 0 && (
                <div className="mb-6 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-700">Georgian Public Holiday</p>
                  {selectedDayHolidays.map((h, hi) => (
                    <div
                      key={`${h.date}-${hi}`}
                      className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-slate-800"
                      title={h.name}
                    >
                      {holidayLabel(h)}
                    </div>
                  ))}
                </div>
              )}

              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {selectedDayHolidays.length > 0
                    ? "No FLH events scheduled for this day."
                    : "No events on this day."}
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedDayEvents.map((ev) => {
                    const owners = getOwnerMembers(ev.ownerUserIds);

                    return (
                      <div
                        key={ev.id}
                        onClick={() => { setEditing(ev); setModalOpen(true); }}
                        className="cursor-pointer rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 transition-colors hover:bg-amber-50/50"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${DEPT_CONFIG[ev.department].dot}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{ev.title}</p>
                              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${DEPT_CONFIG[ev.department].color}`}>
                                {DEPT_CONFIG[ev.department].label}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {ev.time
                                ? `${ev.time}${ev.endTime ? ` – ${ev.endTime}` : ""}`
                                : "Time not set yet"}
                              {ev.location && ` · ${ev.location}`}
                            </p>
                            {ev.description && (
                              <p className="mt-2 text-sm text-slate-600 line-clamp-3">{ev.description}</p>
                            )}
                            {owners.length > 0 && (
                              <div className="mt-3 flex items-center gap-2">
                                <MemberAvatarStack
                                  names={owners.map((owner) => owner.name)}
                                  size="sm"
                                />
                                <p className="text-xs text-slate-400 truncate">
                                  {owners.map((owner) => owner.name).join(", ")}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(EMPTY); }} title={editing.id ? (canEdit ? "Edit Event" : "View Event") : "New Event"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Event Title *</label>
            <input disabled={!canEdit} type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50" placeholder="e.g., Summer Program Kickoff" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input disabled={!canEdit} type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
              <input disabled={!canEdit} type="time" value={editing.time} onChange={(e) => setEditing({ ...editing, time: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
              <input disabled={!canEdit} type="time" value={editing.endTime} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <select disabled={!canEdit} value={editing.department} onChange={(e) => setEditing({ ...editing, department: e.target.value as Department })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50">
                {(Object.keys(DEPT_CONFIG) as Department[]).map((d) => (<option key={d} value={d}>{DEPT_CONFIG[d].label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input disabled={!canEdit} type="text" value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50" placeholder="e.g., Conference Room A" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea disabled={!canEdit} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 resize-none disabled:bg-slate-50" placeholder="Event details..." />
          </div>
          <MemberMultiSelect
            members={members}
            selectedIds={editing.ownerUserIds}
            onChange={(ownerUserIds) => setEditing({ ...editing, ownerUserIds })}
            disabled={!canEdit}
          />
          {canEdit && (
            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveEvent} disabled={!editing.title.trim() || !editing.date} className="flex-1  px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors">
                {editing.id ? "Save Changes" : "Create Event"}
              </button>
              {editing.id ? (
                <button onClick={() => { handleDelete(editing.id); setModalOpen(false); setEditing(EMPTY); }} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors">Delete</button>
              ) : null}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
