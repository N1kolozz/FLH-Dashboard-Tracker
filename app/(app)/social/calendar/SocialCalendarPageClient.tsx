"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { getContentPosts, createContentPost, updateContentPost, deleteContentPost } from "@/app/actions/content-posts";
import type { ContentPostRow } from "@/app/actions/content-posts";
import { type MemberChoice } from "@/components/MemberMultiSelect";
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
import type { Session } from "@/lib/auth";
import { normalizeOwnerUserIds } from "@/lib/owner-users";
import {
  submitForReview,
  approveReview,
  rejectReview,
  getPostReviewStatuses,
} from "@/app/actions/reviews";
import {
  EMPTY_POST,
  MONTHS,
  PLATFORM_CONFIG,
  PLATFORM_SHORT_LABEL,
  WEEKDAYS,
  getMonthDays,
  getPostPayload,
  rowToPost,
  sortPosts,
  type CalendarLayout,
  type CalendarView,
  type ContentPost,
} from "@/features/social/calendar/model";
import {
  CalendarDataSkeleton,
  LoadingStatCards,
} from "@/features/social/calendar/skeletons";
import {
  PostDetailModal,
  PostFormModal,
  PostReviewModal,
  SelectedDayDetailsDrawer,
  SocialCalendarHeader,
  SocialCalendarToolbar,
} from "@/features/social/calendar/ui";

export default function SocialCalendarPageClient({
  initialSession,
  initialPosts,
  initialMembers,
  initialReviewStatuses,
}: {
  initialSession: Session | null;
  initialPosts: ContentPostRow[];
  initialMembers: { id: number; name: string }[];
  initialReviewStatuses: Record<
    number,
    { status: string; reviewId: number; feedback: string | null }
  >;
}) {
  const [posts, setPosts] = useState<ContentPost[]>(sortPosts(initialPosts.map(rowToPost)));
  const [members] = useState<MemberChoice[]>(
    initialMembers
      .map((member) => ({ id: member.id, name: member.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContentPost>(EMPTY_POST);
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [calendarLayout, setCalendarLayout] = useState<CalendarLayout>("slide");
  const [calendarCursor, setCalendarCursor] = useState(() => getLocalISODate());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const holidaysCacheRef = useRef<Record<number, PublicHoliday[]>>({});
  const [session] = useState<Session | null>(initialSession);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [reviewStatuses, setReviewStatuses] = useState<
    Record<number, { status: string; reviewId: number; feedback: string | null }>
  >(initialReviewStatuses);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ postId: number; reviewId: number; postCaption: string } | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [detailPost, setDetailPost] = useState<ContentPost | null>(null);
  const deepLinkHandledRef = useRef(false);

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

  useEffect(() => {
    if (deepLinkHandledRef.current) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const urlReviewId = urlParams.get("reviewId");
    const urlPostId = urlParams.get("postId");

    if (!urlReviewId || !urlPostId) {
      return;
    }

    deepLinkHandledRef.current = true;
    const postId = Number(urlPostId);
    const reviewId = Number(urlReviewId);
    const targetPost = initialPosts.find((post) => post.id === postId) ?? null;

    if (!targetPost || !Number.isInteger(reviewId)) {
      return;
    }

    const targetDate = targetPost.date;
    const targetMonth = new Date(`${targetDate}T00:00:00`);

    if (!Number.isNaN(targetMonth.getTime())) {
      setViewMonth(targetMonth.getMonth());
      setViewYear(targetMonth.getFullYear());
      setCalendarCursor(targetDate);
      setSelectedDate(targetDate);
    }

    setTimeout(() => {
      setReviewTarget({
        postId,
        reviewId,
        postCaption: targetPost.caption,
      });
      setReviewFeedback("");
      setReviewModalOpen(true);
    }, 300);
  }, [initialPosts]);

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
    setEditing(EMPTY_POST);
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
      ...EMPTY_POST,
      date: date || "",
      ownerUserIds: normalizeOwnerUserIds(session?.userId ? [session.userId] : []),
    });
    setModalOpen(true);
  };

  const openPostModal = (post: ContentPost, dateStr?: string) => {
    setCalendarCursor(dateStr ?? post.date);
    setSelectedDate(null);
    setEditing(post);
    setModalOpen(true);
  };

  const openPostPreview = (post: ContentPost) => {
    setDetailPost(post);
  };

  const openPostEdit = (post: ContentPost, dateStr?: string) => {
    setDetailPost(null);
    openPostModal(post, dateStr);
  };

  const handleSubmitForApproval = async () => {
    if (!editing.id) return;

    const result = await submitForReview("content_post", editing.id);
    if (result.success) {
      void refreshPosts();
    }
  };

  const openReviewModal = () => {
    const status = reviewStatuses[editing.id];
    if (!status) return;

    setModalOpen(false);
    setReviewTarget({
      postId: editing.id,
      reviewId: status.reviewId,
      postCaption: editing.caption,
    });
    setReviewFeedback("");
    setReviewModalOpen(true);
  };

  const handleApproveReview = async () => {
    if (!reviewTarget) return;

    setReviewSaving(true);
    const result = await approveReview(reviewTarget.reviewId, reviewFeedback || undefined);
    setReviewSaving(false);

    if (!result.success) return;

    setReviewModalOpen(false);
    setReviewTarget(null);
    setReviewFeedback("");
    void refreshPosts();
  };

  const handleRejectReview = async () => {
    if (!reviewTarget || !reviewFeedback.trim()) return;

    setReviewSaving(true);
    const result = await rejectReview(reviewTarget.reviewId, reviewFeedback);
    setReviewSaving(false);

    if (!result.success) return;

    setReviewModalOpen(false);
    setReviewTarget(null);
    setReviewFeedback("");
    void refreshPosts();
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
      <SocialCalendarHeader canEdit={!!canEdit} onPlanPost={() => openNew()} />

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

        <SocialCalendarToolbar
          calendarView={calendarView}
          calendarLayout={calendarLayout}
          monthLabel={monthLabel}
          weekLabel={weekLabel}
          onShowMonth={() => setCalendarView("month")}
          onShowWeek={() => {
            setCalendarCursor(selectedDate ?? fallbackWeekAnchor);
            setCalendarView("week");
          }}
          onLayoutChange={setCalendarLayout}
          onNavigate={navigateCalendar}
          onGoToToday={goToToday}
        />

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
                                openPostPreview(p);
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
                                openPostPreview(p);
                              }}
                              className={`group/card relative rounded-xl border px-2.5 py-2 text-[11px] font-medium transition-transform hover:-translate-y-0.5 ${PLATFORM_CONFIG[p.platform].color}`}
                              title={p.caption}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{PLATFORM_CONFIG[p.platform].label}</span>
                                <div className="flex shrink-0 items-center gap-1">
                                  {p.time && <span className="text-[10px] opacity-75">{p.time}</span>}
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openPostEdit(p, dateStr); }}
                                      aria-label="Edit post"
                                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-current/20 bg-white/60 opacity-0 transition-opacity hover:bg-white/90 group-hover/card:opacity-100"
                                    >
                                      <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
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
                                openPostPreview(p);
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
                                openPostPreview(p);
                              }}
                              className={`group/card relative rounded-xl border px-3 py-2.5 text-[11px] font-medium transition-transform hover:-translate-y-0.5 ${PLATFORM_CONFIG[p.platform].color}`}
                              title={p.caption}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{PLATFORM_CONFIG[p.platform].label}</span>
                                <div className="flex shrink-0 items-center gap-1">
                                  {p.time && <span className="text-[10px] opacity-75">{p.time}</span>}
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openPostEdit(p, dateStr); }}
                                      aria-label="Edit post"
                                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-current/20 bg-white/60 opacity-0 transition-opacity hover:bg-white/90 group-hover/card:opacity-100"
                                    >
                                      <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
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

      <SelectedDayDetailsDrawer
        selectedDate={selectedDate}
        selectedDayLabel={selectedDayLabel}
        selectedDayPosts={selectedDayPosts}
        selectedDayHolidays={selectedDayHolidays}
        canEdit={!!canEdit}
        getOwnerMembers={getOwnerMembers}
        onClose={() => setSelectedDate(null)}
        onAddPost={() => {
          if (!selectedDate) return;
          openNew(selectedDate);
        }}
        onOpenPost={(post) => openPostPreview(post)}
        onEditPost={canEdit ? (post) => openPostEdit(post) : undefined}
      />

      <PostDetailModal
        open={detailPost !== null}
        post={detailPost}
        canEdit={!!canEdit}
        members={members}
        reviewStatus={detailPost?.id ? reviewStatuses[detailPost.id] ?? null : null}
        onClose={() => setDetailPost(null)}
        onEdit={() => {
          if (detailPost) openPostEdit(detailPost);
        }}
      />

      <PostFormModal
        open={modalOpen}
        post={editing}
        canEdit={!!canEdit}
        isHeadOrAdmin={!!isHeadOrAdmin}
        members={members}
        reviewStatus={editing.id ? reviewStatuses[editing.id] || null : null}
        onClose={() => {
          setModalOpen(false);
          setEditing(EMPTY_POST);
        }}
        onPostChange={setEditing}
        onSave={savePost}
        onDelete={() => {
          void handleDeletePost(editing.id);
          setModalOpen(false);
          setEditing(EMPTY_POST);
        }}
        onSubmitForApproval={() => {
          void handleSubmitForApproval();
        }}
        onOpenReview={openReviewModal}
      />

      <PostReviewModal
        open={reviewModalOpen}
        reviewTarget={reviewTarget}
        reviewFeedback={reviewFeedback}
        reviewSaving={reviewSaving}
        onClose={() => {
          setReviewModalOpen(false);
          setReviewTarget(null);
          setReviewFeedback("");
        }}
        onFeedbackChange={setReviewFeedback}
        onApprove={() => {
          void handleApproveReview();
        }}
        onReject={() => {
          void handleRejectReview();
        }}
      />
    </div>
  );
}
