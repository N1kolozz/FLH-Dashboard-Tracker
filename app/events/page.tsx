"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { loadStore, saveStore, generateId } from "@/lib/store";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import {
  type PublicHoliday,
  buildHolidaysByDate,
  fetchPublicHolidaysWithStatus,
  holidayChipClass,
  holidayLabel,
} from "@/lib/public-holidays";

/* ─── Types ─── */
type Department = "pr" | "logistics" | "projects" | "other";

interface CalEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  department: Department;
  description: string;
  createdAt: string;
}

const STORE_KEY = "flh_events";

const DEPT_CONFIG: Record<Department, { label: string; color: string; dot: string }> = {
  pr: { label: "PR & Social", color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  logistics: { label: "Logistics", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  projects: { label: "Projects", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  other: { label: "Other", color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMPTY: CalEvent = { id: "", title: "", date: "", time: "", endTime: "", location: "", department: "other", description: "", createdAt: "" };

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

function getLocalISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function EventsPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalEvent>(EMPTY);
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const holidaysCacheRef = useRef<Record<number, PublicHoliday[]>>({});

  useEffect(() => { setEvents(loadStore<CalEvent>(STORE_KEY)); }, []);

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

  const persist = (next: CalEvent[]) => { setEvents(next); saveStore(STORE_KEY, next); };

  const saveEvent = () => {
    if (!editing.title.trim() || !editing.date) return;
    let next: CalEvent[];
    if (editing.id) {
      next = events.map((e) => (e.id === editing.id ? editing : e));
    } else {
      next = [...events, { ...editing, id: generateId(), createdAt: new Date().toISOString() }];
    }
    persist(next);
    setModalOpen(false);
    setEditing(EMPTY);
  };

  const deleteEvent = (id: string) => { persist(events.filter((e) => e.id !== id)); };

  const openNew = (date?: string) => {
    setEditing({ ...EMPTY, date: date || "" });
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

  const cells = getMonthDays(viewYear, viewMonth);
  // Use local date (not UTC) to avoid off-by-one day in some timezones.
  const today = getLocalISODate();

  const eventsForDate = (dateStr: string) => events.filter((e) => e.date === dateStr);

  const upcomingEvents = [...events]
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 20);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-purple-200/70 bg-gradient-to-r from-amber-50/70 via-orange-50/65 to-yellow-50/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Events
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {events.length} event{events.length !== 1 ? "s" : ""} · {upcomingEvents.length} upcoming
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              <button onClick={() => setView("calendar")} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === "calendar" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Calendar</button>
              <button onClick={() => setView("list")} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === "list" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>List</button>
            </div>
            <button
              onClick={() => openNew()}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              + New Event
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {events.length === 0 && view === "list" ? (
          <EmptyState
            title="No events yet"
            description="Create your first event to start organizing your calendar."
            icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            action={{ label: "Create Event", onClick: () => openNew() }}
          />
        ) : view === "calendar" ? (
          <div>
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">← Prev</button>
              <h2 className="text-lg font-semibold text-slate-800">{MONTHS[viewMonth]} {viewYear}</h2>
              <button onClick={nextMonth} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Next →</button>
            </div>
            {/* Calendar grid */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-7">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-slate-500 uppercase bg-slate-50 border-b border-slate-200">{d}</div>
                ))}
                {cells.map((day, idx) => {
                  if (day === null) return <div key={idx} className="min-h-[80px] border-b border-r border-slate-100 bg-slate-50/50" />;
                  const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayEvents = eventsForDate(dateStr);
                  const dayHolidays = holidaysByDate.get(dateStr) ?? [];
                  const holidayLines =
                    Math.min(dayHolidays.length, 2) + (dayHolidays.length > 2 ? 1 : 0);
                  const eventSlots = Math.max(0, 3 - holidayLines);
                  const isToday = dateStr === today;
                  const isSelected = dateStr === selectedDate;
                  return (
                    <div
                      key={idx}
                      onClick={() => { setSelectedDate(dateStr === selectedDate ? null : dateStr); }}
                      className={`min-h-[80px] border-b border-r border-slate-100 px-1.5 py-1 cursor-pointer transition-colors hover:bg-purple-50/30 ${isSelected ? "bg-purple-50" : ""}`}
                    >
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-purple-600 text-white" : "text-slate-600"}`}>
                        {day}
                      </div>
                      {dayHolidays.slice(0, 2).map((h, hi) => (
                        <div key={`${h.date}-${hi}`} className={holidayChipClass} title={h.name}>
                          {holidayLabel(h)}
                        </div>
                      ))}
                      {dayHolidays.length > 2 && (
                        <p className="text-[10px] text-slate-400 px-1 mb-0.5">+{dayHolidays.length - 2} holiday</p>
                      )}
                      {dayEvents.slice(0, eventSlots).map((ev) => (
                        <div
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); setEditing(ev); setModalOpen(true); }}
                          className={`text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer font-medium ${DEPT_CONFIG[ev.department].color}`}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > eventSlots && (
                        <p className="text-[10px] text-slate-400 px-1">+{dayEvents.length - eventSlots} more</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected day events */}
            {selectedDate && (
              <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Events on {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                  </h3>
                  <button onClick={() => openNew(selectedDate)} className="text-xs text-purple-600 hover:underline font-medium">+ Add event</button>
                </div>
                {(holidaysByDate.get(selectedDate) ?? []).length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">Georgian public holiday</p>
                    {(holidaysByDate.get(selectedDate) ?? []).map((h, hi) => (
                      <div
                        key={`${h.date}-${hi}`}
                        className="text-sm text-slate-800 border border-amber-100 bg-amber-50/60 rounded-lg px-3 py-2"
                        title={h.name}
                      >
                        {holidayLabel(h)}
                      </div>
                    ))}
                  </div>
                )}
                {eventsForDate(selectedDate).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    {(holidaysByDate.get(selectedDate) ?? []).length > 0
                      ? "No FLH events scheduled for this day."
                      : "No events on this day."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {eventsForDate(selectedDate).sort((a, b) => a.time.localeCompare(b.time)).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => { setEditing(ev); setModalOpen(true); }}
                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${DEPT_CONFIG[ev.department].dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">{ev.title}</p>
                          <p className="text-xs text-slate-500">
                            {ev.time && `${ev.time}${ev.endTime ? ` – ${ev.endTime}` : ""}`}
                            {ev.location && ` · 📍 ${ev.location}`}
                          </p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${DEPT_CONFIG[ev.department].color}`}>
                          {DEPT_CONFIG[ev.department].label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* List view */
          <div className="space-y-2">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No upcoming events.</p>
            ) : (
              upcomingEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => { setEditing(ev); setModalOpen(true); }}
                  className="flex items-center gap-4 bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md cursor-pointer transition-all duration-150 hover:-translate-y-0.5"
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
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${DEPT_CONFIG[ev.department].color}`}>
                    {DEPT_CONFIG[ev.department].label}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(EMPTY); }} title={editing.id ? "Edit Event" : "New Event"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Event Title *</label>
            <input type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="e.g., Summer Program Kickoff" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
              <input type="time" value={editing.time} onChange={(e) => setEditing({ ...editing, time: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
              <input type="time" value={editing.endTime} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <select value={editing.department} onChange={(e) => setEditing({ ...editing, department: e.target.value as Department })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                {(Object.keys(DEPT_CONFIG) as Department[]).map((d) => (<option key={d} value={d}>{DEPT_CONFIG[d].label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input type="text" value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" placeholder="e.g., Conference Room A" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" placeholder="Event details..." />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={saveEvent} disabled={!editing.title.trim() || !editing.date} className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors">
              {editing.id ? "Save Changes" : "Create Event"}
            </button>
            {editing.id && (
              <button onClick={() => { deleteEvent(editing.id); setModalOpen(false); setEditing(EMPTY); }} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors">Delete</button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
