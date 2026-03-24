"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { loadStore, saveStore, generateId } from "@/lib/store";
import Modal from "@/components/Modal";
import {
  type PublicHoliday,
  buildHolidaysByDate,
  fetchPublicHolidaysWithStatus,
  holidayChipClass,
  holidayLabel,
} from "@/lib/public-holidays";

/* ─── Types ─── */
type Platform = "instagram" | "tiktok" | "facebook";
type PostStatus = "draft" | "scheduled" | "published";

interface ContentPost {
  id: string;
  platform: Platform;
  caption: string;
  date: string;
  time: string;
  status: PostStatus;
  notes: string;
  createdAt: string;
}

const STORE_KEY = "flh_content_posts";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const PLATFORM_CONFIG: Record<Platform, { label: string; color: string; dot: string; icon: string }> = {
  instagram: { label: "Instagram", color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500", icon: "📷" },
  tiktok: { label: "TikTok", color: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-700", icon: "🎵" },
  facebook: { label: "Facebook", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-600", icon: "📘" },
};

const STATUS_CONFIG: Record<PostStatus, { label: string; classes: string }> = {
  draft: { label: "Draft", classes: "bg-slate-100 text-slate-600" },
  scheduled: { label: "Scheduled", classes: "bg-amber-100 text-amber-700" },
  published: { label: "Published", classes: "bg-emerald-100 text-emerald-700" },
};

const EMPTY: ContentPost = { id: "", platform: "instagram", caption: "", date: "", time: "", status: "draft", notes: "", createdAt: "" };

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay() - 1;
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

export default function ContentCalendarPage() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContentPost>(EMPTY);
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const holidaysCacheRef = useRef<Record<number, PublicHoliday[]>>({});

  useEffect(() => { setPosts(loadStore<ContentPost>(STORE_KEY)); }, []);

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

  const persist = (next: ContentPost[]) => { setPosts(next); saveStore(STORE_KEY, next); };

  const savePost = () => {
    if (!editing.caption.trim() || !editing.date) return;
    let next: ContentPost[];
    if (editing.id) {
      next = posts.map((p) => (p.id === editing.id ? editing : p));
    } else {
      next = [...posts, { ...editing, id: generateId(), createdAt: new Date().toISOString() }];
    }
    persist(next);
    setModalOpen(false);
    setEditing(EMPTY);
  };

  const deletePost = (id: string) => { persist(posts.filter((p) => p.id !== id)); };

  const openNew = (date?: string) => {
    setEditing({ ...EMPTY, date: date || "" });
    setModalOpen(true);
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1); };

  const cells = getMonthDays(viewYear, viewMonth);
  // Use local date (not UTC) so "today" matches the user's timezone.
  const today = getLocalISODate();

  const postsForDate = (dateStr: string) => posts.filter((p) => p.date === dateStr);

  // Summary stats
  const monthPosts = posts.filter((p) => p.date.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`));
  const draftCount = monthPosts.filter((p) => p.status === "draft").length;
  const scheduledCount = monthPosts.filter((p) => p.status === "scheduled").length;
  const publishedCount = monthPosts.filter((p) => p.status === "published").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-purple-200/70 bg-gradient-to-r from-violet-100/70 via-purple-100/65 to-fuchsia-100/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Content Calendar
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Plan and schedule posts across platforms</p>
          </div>
          <button
            onClick={() => openNew()}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >+ Plan Post</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
            <p className="text-xl font-bold text-slate-900">{draftCount}</p>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Drafts</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
            <p className="text-xl font-bold text-amber-600">{scheduledCount}</p>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Scheduled</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
            <p className="text-xl font-bold text-emerald-600">{publishedCount}</p>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Published</p>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">← Prev</button>
          <h2 className="text-lg font-semibold text-slate-800">{MONTHS[viewMonth]} {viewYear}</h2>
          <button onClick={nextMonth} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Next →</button>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-slate-500 uppercase bg-slate-50 border-b border-slate-200">{d}</div>
            ))}
            {cells.map((day, idx) => {
              if (day === null) return <div key={idx} className="min-h-[80px] border-b border-r border-slate-100 bg-slate-50/50" />;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayPosts = postsForDate(dateStr);
              const dayHolidays = holidaysByDate.get(dateStr) ?? [];
              const holidayLines =
                Math.min(dayHolidays.length, 2) + (dayHolidays.length > 2 ? 1 : 0);
              const postSlots = Math.max(0, 3 - holidayLines);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                  className={`min-h-[80px] border-b border-r border-slate-100 px-1.5 py-1 cursor-pointer transition-colors hover:bg-purple-50/30 ${isSelected ? "bg-purple-50" : ""}`}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-purple-600 text-white" : "text-slate-600"}`}>{day}</div>
                  {dayHolidays.slice(0, 2).map((h, hi) => (
                    <div key={`${h.date}-${hi}`} className={holidayChipClass} title={h.name}>
                      {holidayLabel(h)}
                    </div>
                  ))}
                  {dayHolidays.length > 2 && (
                    <p className="text-[10px] text-slate-400 px-1 mb-0.5">+{dayHolidays.length - 2} holiday</p>
                  )}
                  {dayPosts.slice(0, postSlots).map((p) => (
                    <div
                      key={p.id}
                      onClick={(e) => { e.stopPropagation(); setEditing(p); setModalOpen(true); }}
                      className={`text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer font-medium ${PLATFORM_CONFIG[p.platform].color}`}
                    >
                      {PLATFORM_CONFIG[p.platform].icon} {p.caption.slice(0, 20)}
                    </div>
                  ))}
                  {dayPosts.length > postSlots && <p className="text-[10px] text-slate-400 px-1">+{dayPosts.length - postSlots}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected day */}
        {selectedDate && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Posts for {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </h3>
              <button onClick={() => openNew(selectedDate)} className="text-xs text-purple-600 hover:underline font-medium">+ Add post</button>
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
            {postsForDate(selectedDate).length === 0 ? (
              <p className="text-sm text-slate-500">No posts planned for this day.</p>
            ) : (
              <div className="space-y-2">
                {postsForDate(selectedDate).sort((a, b) => a.time.localeCompare(b.time)).map((p) => (
                  <div key={p.id} onClick={() => { setEditing(p); setModalOpen(true); }} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${PLATFORM_CONFIG[p.platform].dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800 line-clamp-1">{p.caption}</p>
                      <p className="text-xs text-slate-500">{PLATFORM_CONFIG[p.platform].label} {p.time && `· ${p.time}`}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CONFIG[p.status].classes}`}>{STATUS_CONFIG[p.status].label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(EMPTY); }} title={editing.id ? "Edit Post" : "Plan a Post"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Platform</label>
            <select value={editing.platform} onChange={(e) => setEditing({ ...editing, platform: e.target.value as Platform })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
              {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((p) => (<option key={p} value={p}>{PLATFORM_CONFIG[p].icon} {PLATFORM_CONFIG[p].label}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Caption / Content *</label>
            <textarea value={editing.caption} onChange={(e) => setEditing({ ...editing, caption: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" placeholder="Post caption or content idea..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
              <input type="time" value={editing.time} onChange={(e) => setEditing({ ...editing, time: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as PostStatus })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                {(Object.keys(STATUS_CONFIG) as PostStatus[]).map((s) => (<option key={s} value={s}>{STATUS_CONFIG[s].label}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" placeholder="Internal notes..." />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={savePost} disabled={!editing.caption.trim() || !editing.date} className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors">{editing.id ? "Save Changes" : "Plan Post"}</button>
            {editing.id && (
              <button onClick={() => { deletePost(editing.id); setModalOpen(false); setEditing(EMPTY); }} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors">Delete</button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
