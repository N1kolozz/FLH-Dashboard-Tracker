"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { getContentPosts, createContentPost, updateContentPost, deleteContentPost } from "@/app/actions/content-posts";
import type { ContentPostRow } from "@/app/actions/content-posts";
import { getMembers } from "@/app/actions/members";
import MemberAvatarStack from "@/components/MemberAvatarStack";
import MemberMultiSelect, { type MemberChoice } from "@/components/MemberMultiSelect";
import Modal from "@/components/Modal";
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
import { getCurrentSession } from "@/app/actions/session";
import type { Session } from "@/lib/auth";
import {
  submitForReview,
  approveReview,
  rejectReview,
  getPostReviewStatuses,
} from "@/app/actions/reviews";

/* ─── Types ─── */
type Platform = "instagram" | "tiktok" | "facebook";
type PostStatus = "draft" | "scheduled" | "published";
type CalendarLayout = "slide" | "fit";

interface ContentPost {
  id: number;
  platform: Platform;
  caption: string;
  date: string;
  time: string;
  status: PostStatus;
  notes: string;
  ownerUserIds: number[];
  createdAt: string;
}

type CalendarView = "month" | "week";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const PLATFORM_CONFIG: Record<Platform, { label: string; color: string; dot: string; }> = {
  instagram: { label: "Instagram", color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500"},
  tiktok: { label: "TikTok", color: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-700"},
  facebook: { label: "Facebook", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-600"},
};
const PLATFORM_SHORT_LABEL: Record<Platform, string> = {
  instagram: "IG",
  tiktok: "TT",
  facebook: "FB",
};

const STATUS_CONFIG: Record<PostStatus, { label: string; classes: string }> = {
  draft: { label: "Draft", classes: "bg-slate-100 text-slate-600" },
  scheduled: { label: "Scheduled", classes: "bg-amber-100 text-amber-700" },
  published: { label: "Published", classes: "bg-emerald-100 text-emerald-700" },
};

const EMPTY: ContentPost = {
  id: 0,
  platform: "instagram",
  caption: "",
  date: "",
  time: "",
  status: "draft",
  notes: "",
  ownerUserIds: [],
  createdAt: "",
};

function getPostPayload(post: ContentPost) {
  return {
    platform: post.platform,
    caption: post.caption.trim(),
    date: post.date,
    time: post.time,
    status: post.status,
    notes: post.notes,
    ownerUserIds: post.ownerUserIds,
  };
}

function rowToPost(row: ContentPostRow): ContentPost {
  return {
    id: row.id,
    platform: row.platform as Platform,
    caption: row.caption,
    date: row.date,
    time: row.time,
    status: row.status as PostStatus,
    notes: row.notes,
    ownerUserIds: (row.owner_user_ids || []).map(Number),
    createdAt: row.created_at,
  };
}

function sortPosts(items: ContentPost[]) {
  return [...items].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.time.localeCompare(b.time) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

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

export default function ContentCalendarPage() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [members, setMembers] = useState<MemberChoice[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContentPost>(EMPTY);
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [calendarLayout, setCalendarLayout] = useState<CalendarLayout>("slide");
  const [calendarCursor, setCalendarCursor] = useState(() => getLocalISODate());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const holidaysCacheRef = useRef<Record<number, PublicHoliday[]>>({});
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [reviewStatuses, setReviewStatuses] = useState<
    Record<number, { status: string; reviewId: number; feedback: string | null }>
  >({});
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ postId: number; reviewId: number; postCaption: string } | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  useEffect(() => {
    async function init() {
      setIsLoadingData(true);
      try {
        const [sess, postRes, memberRes, revStatuses] = await Promise.all([
          getCurrentSession(),
          getContentPosts(),
          getMembers(),
          getPostReviewStatuses(),
        ]);
        setSession(sess);
        if (postRes.success && postRes.posts) {
          setPosts(sortPosts(postRes.posts.map(rowToPost)));
        }
        if (memberRes.success && memberRes.members) {
          const nextMembers = (memberRes.members as { id: number; name: string }[])
            .map((member) => ({ id: member.id, name: member.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setMembers(nextMembers);
        }
        setReviewStatuses(revStatuses);
      } finally {
        setIsLoadingData(false);
      }
    }
    init();
  }, []);

  const canEdit = session && (
    session.role === "ADMIN" || 
    session.role === "HEAD" || 
    session.department === "PR & Social"
  );

  const isHeadOrAdmin = session && (
    session.role === "ADMIN" ||
    session.role === "HEAD"
  );

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

  const refreshPosts = async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
    if (showLoading) {
      setIsLoadingData(true);
    }

    try {
      const [res, revStatuses] = await Promise.all([
        getContentPosts(),
        getPostReviewStatuses(),
      ]);
      if (res.success && res.posts) {
        setPosts(sortPosts(res.posts.map(rowToPost)));
      }
      setReviewStatuses(revStatuses);
    } finally {
      if (showLoading) {
        setIsLoadingData(false);
      }
    }
  };

  const savePost = async () => {
    const nextPost = {
      ...editing,
      caption: editing.caption.trim(),
    };

    if (!nextPost.caption || !nextPost.date) return;

    if (nextPost.id) {
      const previousPost = posts.find((post) => post.id === nextPost.id);

      setPosts((current) =>
        sortPosts(
          current.map((post) =>
            post.id === nextPost.id
              ? {
                  ...nextPost,
                  createdAt: previousPost?.createdAt ?? post.createdAt,
                }
              : post
          )
        )
      );

      const result = await updateContentPost(nextPost.id, getPostPayload(nextPost));

      if (!result.success) {
        if (previousPost) {
          setPosts((current) =>
            sortPosts(
              current.map((post) =>
                post.id === previousPost.id ? previousPost : post
              )
            )
          );
        }
        return;
      }
    } else {
      const result = await createContentPost(getPostPayload(nextPost));

      if (!result.success || typeof result.id !== "number") {
        return;
      }

      setPosts((current) =>
        sortPosts([
          {
            ...nextPost,
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
    void refreshPosts();
  };

  const handleDeletePost = async (id: number) => {
    const deletedPost = posts.find((post) => post.id === id);

    setPosts((current) => current.filter((post) => post.id !== id));

    const result = await deleteContentPost(id);

    if (!result.success) {
      if (deletedPost) {
        setPosts((current) => sortPosts([deletedPost, ...current]));
      }
      return;
    }

    void refreshPosts();
  };

  const openNew = (date?: string) => {
    setEditing({
      ...EMPTY,
      date: date || "",
      ownerUserIds: session?.userId ? [Number(session.userId)] : [],
    });
    setModalOpen(true);
  };

  const openPostModal = (post: ContentPost, dateStr?: string) => {
    setCalendarCursor(dateStr ?? post.date);
    setSelectedDate(null);
    setEditing(post);
    setModalOpen(true);
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1); };
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

  const postsForDate = (dateStr: string) => posts.filter((p) => p.date === dateStr);
  const getOwnerMembers = (ownerUserIds: number[]) =>
    members.filter((member) => ownerUserIds.includes(member.id));

  // Summary stats
  const monthPosts = posts.filter((p) => p.date.startsWith(currentMonthKey));
  const draftCount = monthPosts.filter((p) => p.status === "draft").length;
  const scheduledCount = monthPosts.filter((p) => p.status === "scheduled").length;
  const publishedCount = monthPosts.filter((p) => p.status === "published").length;
  const activeDaysCount = new Set(monthPosts.map((p) => p.date)).size;
  const selectedDayPosts = selectedDate
    ? [...postsForDate(selectedDate)].sort((a, b) => a.time.localeCompare(b.time))
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-purple-200/70 bg-gradient-to-r from-violet-100/70 via-purple-100/65 to-fuchsia-100/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Content Calendar
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Plan and schedule posts across platforms</p>
          </div>
          {canEdit && (
            <button
              onClick={() => openNew()}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >+ Plan Post</button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6">
        {/* Stats */}
        {isLoadingData ? (
          <LoadingStatCards />
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Drafts</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{draftCount}</p>
              <p className="mt-1 text-sm text-slate-500">Ideas still being shaped</p>
            </div>
            <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-white to-amber-50/70 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">Scheduled</p>
              <p className="mt-3 text-3xl font-semibold text-amber-600">{scheduledCount}</p>
              <p className="mt-1 text-sm text-slate-500">Ready to go live</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-white to-emerald-50/70 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-500">Published</p>
              <p className="mt-3 text-3xl font-semibold text-emerald-600">{publishedCount}</p>
              <p className="mt-1 text-sm text-slate-500">Already posted this month</p>
            </div>
            <div className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-white to-violet-50/70 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-500">Active Days</p>
              <p className="mt-3 text-3xl font-semibold text-violet-600">{activeDaysCount}</p>
              <p className="mt-1 text-sm text-slate-500">Days with planned content</p>
            </div>
          </div>
        )}

        <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-500">
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
                <button
                  onClick={() => navigateCalendar("prev")}
                  className="whitespace-nowrap rounded-xl border border-transparent bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  ← Prev
                </button>
                <button
                  onClick={goToToday}
                  className="whitespace-nowrap rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100"
                >
                  Today
                </button>
                <button
                  onClick={() => navigateCalendar("next")}
                  className="whitespace-nowrap rounded-xl border border-transparent bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((platform) => (
              <span
                key={platform}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-medium ${PLATFORM_CONFIG[platform].color}`}
              >
                <span className={`h-2 w-2 rounded-full ${PLATFORM_CONFIG[platform].dot}`} />
                {PLATFORM_CONFIG[platform].label}
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
                  const dayPosts = postsForDate(dateStr);
                  const dayHolidays = holidaysByDate.get(dateStr) ?? [];
                  const postSlots = isFitLayout ? 2 : Math.max(1, 3 - Math.min(dayHolidays.length, 2) - (dayHolidays.length > 2 ? 1 : 0));
                  const isToday = dateStr === today;
                  const isSelected = dateStr === selectedDate;

                  return (
                    <div
                      key={idx}
                      onClick={() => selectDate(dateStr)}
                      className={`${isFitLayout ? "min-h-[82px] px-1 py-1.5 sm:min-h-[108px] sm:px-1.5 sm:py-2" : "min-h-[150px] px-3 py-3"} cursor-pointer border-b border-r border-slate-200/70 transition-all duration-200 ${
                        isSelected
                          ? "bg-violet-50/80"
                          : isWeekend
                            ? "bg-slate-50/75 hover:bg-violet-50/50"
                            : "bg-white hover:bg-violet-50/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div
                          className={`flex items-center justify-center font-semibold ring-1 ring-inset ${
                            isFitLayout ? "h-6 w-6 rounded-xl text-[10px] sm:h-7 sm:w-7 sm:text-xs" : "h-9 w-9 rounded-2xl text-sm"
                          } ${
                            isToday
                              ? "bg-violet-600 text-white ring-violet-600"
                              : isSelected
                                ? "bg-violet-100 text-violet-700 ring-violet-200"
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
                          {dayPosts.length > 0 && (
                            <span className={`${isFitLayout ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"} rounded-full bg-slate-100 font-semibold text-slate-600`}>
                              {isFitLayout ? `P${dayPosts.length}` : `${dayPosts.length} post${dayPosts.length === 1 ? "" : "s"}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {isFitLayout ? (
                        <div className="mt-1.5 space-y-1 sm:mt-2">
                          {dayPosts.slice(0, postSlots).map((p) => (
                            <div
                              key={p.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPostModal(p, dateStr);
                              }}
                              className={`rounded-md border px-1 py-0.5 text-[9px] font-semibold sm:px-1.5 ${PLATFORM_CONFIG[p.platform].color}`}
                              title={p.caption}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate">{PLATFORM_SHORT_LABEL[p.platform]}</span>
                                {p.time && <span className="shrink-0 opacity-70">{p.time}</span>}
                              </div>
                            </div>
                          ))}
                          {dayPosts.length > postSlots && (
                            <p className="px-0.5 text-[9px] font-semibold text-slate-400 sm:text-[10px]">
                              +{dayPosts.length - postSlots}
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
                          {dayPosts.slice(0, postSlots).map((p) => (
                            <div
                              key={p.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPostModal(p, dateStr);
                              }}
                              className={`rounded-xl border px-2.5 py-2 text-[11px] font-medium transition-transform hover:-translate-y-0.5 ${PLATFORM_CONFIG[p.platform].color}`}
                              title={p.caption}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{PLATFORM_CONFIG[p.platform].label}</span>
                                {p.time && <span className="shrink-0 text-[10px] opacity-75">{p.time}</span>}
                              </div>
                              <p className="mt-1 line-clamp-2 text-[11px] leading-snug opacity-90">
                                {p.caption}
                              </p>
                            </div>
                          ))}
                          {dayPosts.length > postSlots && (
                            <p className="px-1 text-[11px] font-medium text-slate-400">
                              +{dayPosts.length - postSlots} more posts
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
                      <p className={`mt-1 ${isFitLayout ? "text-[10px] sm:text-xs" : "text-sm"} font-semibold ${isToday ? "text-violet-700" : "text-slate-800"}`}>
                        {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7">
                {weekDates.map((date, idx) => {
                  const dateStr = getLocalISODate(date);
                  const dayPosts = postsForDate(dateStr);
                  const dayHolidays = holidaysByDate.get(dateStr) ?? [];
                  const postSlots = isFitLayout ? 2 : Math.max(2, 5 - Math.min(dayHolidays.length, 2) - (dayHolidays.length > 2 ? 1 : 0));
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
                          ? "bg-violet-50/80"
                          : !isCurrentMonth
                            ? "bg-slate-50/70 hover:bg-violet-50/40"
                            : isWeekend
                              ? "bg-slate-50/60 hover:bg-violet-50/40"
                              : "bg-white hover:bg-violet-50/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <div
                            className={`inline-flex items-center justify-center font-semibold ring-1 ring-inset ${
                              isFitLayout ? "h-6 min-w-6 rounded-xl px-2 text-[10px] sm:h-7 sm:min-w-7 sm:text-xs" : "h-9 min-w-9 rounded-2xl px-3 text-sm"
                            } ${
                              isToday
                                ? "bg-violet-600 text-white ring-violet-600"
                                : isSelected
                                  ? "bg-violet-100 text-violet-700 ring-violet-200"
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
                          {dayPosts.length > 0 && (
                            <span className={`${isFitLayout ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"} rounded-full bg-slate-100 font-semibold text-slate-600`}>
                              {isFitLayout ? `P${dayPosts.length}` : `${dayPosts.length} post${dayPosts.length === 1 ? "" : "s"}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {isFitLayout ? (
                        <div className="mt-1.5 space-y-1 sm:mt-2">
                          {dayPosts.slice(0, postSlots).map((p) => (
                            <div
                              key={p.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPostModal(p, dateStr);
                              }}
                              className={`rounded-md border px-1 py-0.5 text-[9px] font-semibold sm:px-1.5 ${PLATFORM_CONFIG[p.platform].color}`}
                              title={p.caption}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate">{PLATFORM_SHORT_LABEL[p.platform]}</span>
                                {p.time && <span className="shrink-0 opacity-70">{p.time}</span>}
                              </div>
                            </div>
                          ))}
                          {dayPosts.length > postSlots && (
                            <p className="px-0.5 text-[9px] font-semibold text-slate-400 sm:text-[10px]">
                              +{dayPosts.length - postSlots}
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
                          {dayPosts.slice(0, postSlots).map((p) => (
                            <div
                              key={p.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPostModal(p, dateStr);
                              }}
                              className={`rounded-xl border px-3 py-2.5 text-[11px] font-medium transition-transform hover:-translate-y-0.5 ${PLATFORM_CONFIG[p.platform].color}`}
                              title={p.caption}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{PLATFORM_CONFIG[p.platform].label}</span>
                                {p.time && <span className="shrink-0 text-[10px] opacity-75">{p.time}</span>}
                              </div>
                              <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug opacity-90">
                                {p.caption}
                              </p>
                            </div>
                          ))}
                          {dayPosts.length > postSlots && (
                            <p className="px-1 text-[11px] font-medium text-slate-400">
                              +{dayPosts.length - postSlots} more posts
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

      {selectedDate && (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="Close day details"
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
            onClick={() => setSelectedDate(null)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-500">Day Details</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{selectedDayLabel}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {selectedDayPosts.length} planned
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
                    className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100"
                  >
                    + Add post
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

              {selectedDayPosts.length === 0 ? (
                <p className="text-sm text-slate-500">No posts planned for this day.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDayPosts.map((p) => {
                    const owners = getOwnerMembers(p.ownerUserIds);

                    return (
                      <div
                        key={p.id}
                        onClick={() => openPostModal(p)}
                        className="cursor-pointer rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 transition-colors hover:bg-violet-50/50"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${PLATFORM_CONFIG[p.platform].dot}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900 line-clamp-2">{p.caption}</p>
                              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${PLATFORM_CONFIG[p.platform].color}`}>
                                {PLATFORM_CONFIG[p.platform].label}
                              </span>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${STATUS_CONFIG[p.status].classes}`}>
                                {STATUS_CONFIG[p.status].label}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {p.time ? `Scheduled for ${p.time}` : "Time not set yet"}
                            </p>
                            {p.notes && (
                              <p className="mt-2 text-sm text-slate-600 line-clamp-3">{p.notes}</p>
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
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(EMPTY); }} title={editing.id ? (canEdit ? "Edit Post" : "View Post") : "Plan a Post"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Platform</label>
            <select disabled={!canEdit} value={editing.platform} onChange={(e) => setEditing({ ...editing, platform: e.target.value as Platform })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50">
              {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((p) => (<option key={p} value={p}>{PLATFORM_CONFIG[p].label}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Caption / Content *</label>
            <textarea disabled={!canEdit} value={editing.caption} onChange={(e) => setEditing({ ...editing, caption: e.target.value })} rows={3} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none disabled:bg-slate-50" placeholder="Post caption or content idea..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input disabled={!canEdit} type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
              <input disabled={!canEdit} type="time" value={editing.time} onChange={(e) => setEditing({ ...editing, time: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select disabled={!canEdit} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as PostStatus })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50">
                {(Object.keys(STATUS_CONFIG) as PostStatus[]).map((s) => (<option key={s} value={s}>{STATUS_CONFIG[s].label}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea disabled={!canEdit} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none disabled:bg-slate-50" placeholder="Internal notes..." />
          </div>
          <MemberMultiSelect
            members={members}
            selectedIds={editing.ownerUserIds}
            onChange={(ownerUserIds) => setEditing({ ...editing, ownerUserIds })}
            disabled={!canEdit}
          />

          {/* Review status section */}
          {editing.id && (() => {
            const rs = reviewStatuses[editing.id];
            return (
              <div className="space-y-2">
                {rs?.status === "approved" && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-semibold">Approved for publishing</span>
                    {rs.feedback && <span className="text-emerald-600">— {rs.feedback}</span>}
                  </div>
                )}
                {rs?.status === "pending" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold">Pending approval from HEAD/Admin</span>
                  </div>
                )}
                {/* Submit for Approval button */}
                {(!rs || rs.status === "rejected") && canEdit && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      void (async () => {
                        const result = await submitForReview("content_post", editing.id);
                        if (result.success) void refreshPosts();
                      })();
                    }}
                    className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Submit for Approval
                  </button>
                )}
                {/* Review button for HEAD/ADMIN */}
                {rs?.status === "pending" && isHeadOrAdmin && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setModalOpen(false);
                      setReviewTarget({ postId: editing.id, reviewId: rs.reviewId, postCaption: editing.caption });
                      setReviewFeedback("");
                      setReviewModalOpen(true);
                    }}
                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.743 7.523 5 12 5c4.478 0 8.268 2.743 9.542 7-1.274 4.257-5.064 7-9.542 7-4.477 0-8.268-2.743-9.542-7z" />
                    </svg>
                    Review This Post
                  </button>
                )}
              </div>
            );
          })()}

          {canEdit && (
            <div className="flex items-center gap-3 pt-2">
              <button onClick={savePost} disabled={!editing.caption.trim() || !editing.date} className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors">{editing.id ? "Save Changes" : "Plan Post"}</button>
              {editing.id ? (
                <button onClick={() => { void handleDeletePost(editing.id); setModalOpen(false); setEditing(EMPTY); }} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors">Delete</button>
              ) : null}
            </div>
          )}
        </div>
      </Modal>

      {/* Review Modal for HEAD/ADMIN */}
      <Modal
        open={reviewModalOpen}
        onClose={() => { setReviewModalOpen(false); setReviewTarget(null); setReviewFeedback(""); }}
        title="Review Post"
      >
        {reviewTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
              <p className="text-sm text-slate-500">Post Content</p>
              <p className="text-sm font-bold text-slate-900 line-clamp-3">{reviewTarget.postCaption}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Feedback <span className="text-slate-400">(required for rejection)</span>
              </label>
              <textarea
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                rows={3}
                className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 resize-none"
                placeholder="Add feedback or comments..."
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={async () => {
                  if (!reviewTarget) return;
                  setReviewSaving(true);
                  const result = await approveReview(reviewTarget.reviewId, reviewFeedback || undefined);
                  setReviewSaving(false);
                  if (result.success) {
                    setReviewModalOpen(false);
                    setReviewTarget(null);
                    setReviewFeedback("");
                    void refreshPosts();
                  }
                }}
                disabled={reviewSaving}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {reviewSaving ? "Approving..." : "Approve"}
              </button>
              <button
                onClick={async () => {
                  if (!reviewTarget || !reviewFeedback.trim()) return;
                  setReviewSaving(true);
                  const result = await rejectReview(reviewTarget.reviewId, reviewFeedback);
                  setReviewSaving(false);
                  if (result.success) {
                    setReviewModalOpen(false);
                    setReviewTarget(null);
                    setReviewFeedback("");
                    void refreshPosts();
                  }
                }}
                disabled={reviewSaving || !reviewFeedback.trim()}
                className="flex-1 px-4 py-2 bg-rose-50 hover:bg-rose-100 disabled:bg-slate-100 text-rose-600 disabled:text-slate-400 text-sm font-medium rounded-lg border border-rose-200 disabled:border-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {reviewSaving ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
