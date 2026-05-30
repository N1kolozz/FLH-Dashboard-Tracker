import { useEffect, useMemo, useState } from "react";
import FixedPortal from "@/components/FixedPortal";
import MemberAvatarStack from "@/components/MemberAvatarStack";
import MemberMultiSelect, { type MemberChoice } from "@/components/MemberMultiSelect";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import AppSelect from "@/components/ui/Select";
import { holidayLabel, type PublicHoliday } from "@/lib/public-holidays";
import {
  PLATFORM_CONFIG,
  PLATFORM_SHORT_LABEL,
  STATUS_CONFIG,
  type ApprovalStatus,
  type CalendarLayout,
  type CalendarView,
  type ContentPost,
  type Platform,
  type PostStatus,
} from "@/features/social/calendar/model";

const PAGE_SIZE = 10;

// "2026-05" → "May 2026"
function formatMonthKey(key: string) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

const APPROVAL_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  rejected: { label: "Rejected", classes: "bg-rose-100 text-rose-700 border border-rose-200" },
  pending: { label: "Pending Review", classes: "bg-amber-100 text-amber-700 border border-amber-200" },
  approved: { label: "Approved", classes: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
};

export function SocialCalendarHeader({
  canEdit,
  pageView,
  onPlanPost,
  onPageViewChange,
}: {
  canEdit: boolean;
  pageView: "calendar" | "list";
  onPlanPost: () => void;
  onPageViewChange: (view: "calendar" | "list") => void;
}) {
  return (
    <header className="border-b border-purple-200/70 bg-gradient-to-r from-violet-100/70 via-purple-100/65 to-fuchsia-100/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            Content Calendar
            <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">Plan and schedule posts across platforms</p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="flex h-10 rounded-lg bg-slate-200/80 p-0.5">
            <button
              onClick={() => onPageViewChange("calendar")}
              className={`flex-1 rounded-md px-4 text-xs font-semibold transition-colors sm:flex-none ${pageView === "calendar" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
            >
              Calendar
            </button>
            <button
              onClick={() => onPageViewChange("list")}
              className={`flex-1 rounded-md px-4 text-xs font-semibold transition-colors sm:flex-none ${pageView === "list" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
            >
              List
            </button>
          </div>
          {canEdit ? (
            <button
              onClick={onPlanPost}
              className="h-10 w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700 sm:w-auto"
            >
              + Plan Post
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function SocialCalendarToolbar({
  calendarView,
  calendarLayout,
  monthLabel,
  weekLabel,
  onShowMonth,
  onShowWeek,
  onLayoutChange,
  onNavigate,
  onGoToToday,
}: {
  calendarView: CalendarView;
  calendarLayout: CalendarLayout;
  monthLabel: string;
  weekLabel: string;
  onShowMonth: () => void;
  onShowWeek: () => void;
  onLayoutChange: (layout: CalendarLayout) => void;
  onNavigate: (direction: "prev" | "next") => void;
  onGoToToday: () => void;
}) {
  return (
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
        <div className="flex w-full flex-col gap-2 xl:w-auto xl:flex-row xl:flex-wrap xl:items-center xl:justify-start">
          <div className="flex w-full rounded-2xl bg-slate-100 p-1 text-sm xl:w-auto">
            <button
              onClick={onShowMonth}
              className={`flex-1 rounded-xl px-4 py-2 text-center font-medium transition-colors ${
                calendarView === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Month
            </button>
            <button
              onClick={onShowWeek}
              className={`flex-1 rounded-xl px-4 py-2 text-center font-medium transition-colors ${
                calendarView === "week" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Week
            </button>
          </div>
          <div className="flex w-full rounded-2xl bg-slate-100 p-1 text-sm xl:w-auto">
            <button
              onClick={() => onLayoutChange("slide")}
              className={`flex-1 rounded-xl px-4 py-2 text-center font-medium transition-colors ${
                calendarLayout === "slide" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Slide
            </button>
            <button
              onClick={() => onLayoutChange("fit")}
              className={`flex-1 rounded-xl px-4 py-2 text-center font-medium transition-colors ${
                calendarLayout === "fit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Fit
            </button>
          </div>
          <div className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1 xl:w-auto">
            <button
              onClick={() => onNavigate("prev")}
              className="flex-1 rounded-xl border border-transparent bg-white px-4 py-2 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              ← Prev
            </button>
            <button
              onClick={onGoToToday}
              className="flex-1 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-center text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100"
            >
              Today
            </button>
            <button
              onClick={() => onNavigate("next")}
              className="flex-1 rounded-xl border border-transparent bg-white px-4 py-2 text-center text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs xl:justify-start">
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
  );
}

export function SelectedDayDetailsDrawer({
  selectedDate,
  selectedDayLabel,
  selectedDayPosts,
  selectedDayHolidays,
  canEdit,
  getOwnerMembers,
  onClose,
  onAddPost,
  onOpenPost,
  onEditPost,
}: {
  selectedDate: string | null;
  selectedDayLabel: string;
  selectedDayPosts: ContentPost[];
  selectedDayHolidays: PublicHoliday[];
  canEdit: boolean;
  getOwnerMembers: (ownerUserIds: number[]) => MemberChoice[];
  onClose: () => void;
  onAddPost: () => void;
  onOpenPost: (post: ContentPost) => void;
  onEditPost?: (post: ContentPost) => void;
}) {
  if (!selectedDate) {
    return null;
  }

  return (
    <FixedPortal>
    <div className="fixed inset-0 z-40">
      <button
        aria-label="Close day details"
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
        onClick={onClose}
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
              {selectedDayHolidays.length > 0 ? (
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  {selectedDayHolidays.length} holiday{selectedDayHolidays.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-4 flex items-center justify-between">
            {canEdit ? (
              <button
                onClick={onAddPost}
                className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100"
              >
                + Add post
              </button>
            ) : (
              <div />
            )}
          </div>

          {selectedDayHolidays.length > 0 ? (
            <div className="mb-6 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-700">Georgian Public Holiday</p>
              {selectedDayHolidays.map((holiday, index) => (
                <div
                  key={`${holiday.date}-${index}`}
                  className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-slate-800"
                  title={holiday.name}
                >
                  {holidayLabel(holiday)}
                </div>
              ))}
            </div>
          ) : null}

          {selectedDayPosts.length === 0 ? (
            <p className="text-sm text-slate-500">No posts planned for this day.</p>
          ) : (
            <div className="space-y-3">
              {selectedDayPosts.map((post) => {
                const owners = getOwnerMembers(post.ownerUserIds);

                return (
                  <div
                    key={post.id}
                    onClick={() => onOpenPost(post)}
                    className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 transition-colors hover:bg-violet-50/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${PLATFORM_CONFIG[post.platform].dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="line-clamp-2 text-sm font-semibold text-slate-900">{post.caption}</p>
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${PLATFORM_CONFIG[post.platform].color}`}>
                              {PLATFORM_CONFIG[post.platform].label}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${STATUS_CONFIG[post.status].classes}`}>
                              {STATUS_CONFIG[post.status].label}
                            </span>
                          </div>
                          {onEditPost ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onEditPost(post); }}
                              aria-label="Edit post"
                              title="Edit post"
                              className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 opacity-0 transition-all hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 group-hover:opacity-100"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {post.time ? `Scheduled for ${post.time}` : "Time not set yet"}
                        </p>
                        {post.notes ? (
                          <p className="mt-2 line-clamp-3 text-sm text-slate-600">{post.notes}</p>
                        ) : null}
                        {owners.length > 0 ? (
                          <div className="mt-3 flex items-center gap-2">
                            <MemberAvatarStack
                              names={owners.map((owner) => owner.name)}
                              size="sm"
                            />
                            <p className="truncate text-xs text-slate-400">
                              {owners.map((owner) => owner.name).join(", ")}
                            </p>
                          </div>
                        ) : null}
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
    </FixedPortal>
  );
}

export function PostFormModal({
  open,
  post,
  canEdit,
  isHeadOrAdmin,
  members,
  reviewStatus,
  saveError,
  onClose,
  onPostChange,
  onSave,
  onDelete,
  onSubmitForApproval,
  onOpenReview,
}: {
  open: boolean;
  post: ContentPost;
  canEdit: boolean;
  isHeadOrAdmin: boolean;
  members: MemberChoice[];
  reviewStatus: { status: string; reviewId: number; feedback: string | null } | null;
  saveError?: string | null;
  onClose: () => void;
  onPostChange: (post: ContentPost) => void;
  onSave: () => void;
  onDelete: () => void;
  onSubmitForApproval: () => void;
  onOpenReview: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={post.id ? (canEdit ? "Edit Post" : "View Post") : "Plan a Post"}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Platform</label>
          <AppSelect
            disabled={!canEdit}
            value={post.platform}
            onValueChange={(v) => onPostChange({ ...post, platform: v as Platform })}
            options={(Object.keys(PLATFORM_CONFIG) as Platform[]).map((p) => ({ value: p, label: PLATFORM_CONFIG[p].label }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Caption / Content *</label>
          <textarea
            disabled={!canEdit}
            value={post.caption}
            onChange={(event) =>
              onPostChange({ ...post, caption: event.target.value })
            }
            rows={6}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50 min-h-[140px]"
            placeholder="Post caption or content idea..."
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date *</label>
            <input
              disabled={!canEdit}
              type="date"
              value={post.date}
              onChange={(event) => onPostChange({ ...post, date: event.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Time</label>
            <input
              disabled={!canEdit}
              type="time"
              value={post.time}
              onChange={(event) => onPostChange({ ...post, time: event.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <AppSelect
              disabled={!canEdit}
              value={post.status}
              onValueChange={(v) => onPostChange({ ...post, status: v as PostStatus })}
              options={(Object.keys(STATUS_CONFIG) as PostStatus[]).map((s) => ({
                value: s,
                label: STATUS_CONFIG[s].label,
                disabled: s === "published" && !isHeadOrAdmin && reviewStatus?.status !== "approved",
              }))}
            />
            {!isHeadOrAdmin && reviewStatus?.status !== "approved" && post.id ? (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Published requires HEAD approval
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Notes <p className="text-xs text-slate-500">(Links and Resources)</p></label>
          <textarea
            disabled={!canEdit}
            value={post.notes}
            onChange={(event) => onPostChange({ ...post, notes: event.target.value })}
            rows={2}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
            placeholder="Internal notes..."
          />
        </div>
        <MemberMultiSelect
          members={members}
          selectedIds={post.ownerUserIds}
          onChange={(ownerUserIds) => onPostChange({ ...post, ownerUserIds })}
          disabled={!canEdit}
        />

        {post.id ? (
          <div className="space-y-2">
            {reviewStatus?.status === "approved" ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold">Approved for publishing</span>
                {reviewStatus.feedback ? (
                  <span className="text-emerald-600">- {reviewStatus.feedback}</span>
                ) : null}
              </div>
            ) : null}
            {reviewStatus?.status === "rejected" ? (
              <div className="flex flex-col gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="font-semibold">Rejected by HEAD</span>
                </div>
                {reviewStatus.feedback ? (
                  <p className="pl-6 text-rose-600">{reviewStatus.feedback}</p>
                ) : null}
              </div>
            ) : null}
            {reviewStatus?.status === "pending" ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">Pending approval from HEAD</span>
              </div>
            ) : null}
            {(!reviewStatus || reviewStatus.status === "rejected") && canEdit ? (
              <button
                onClick={onSubmitForApproval}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Submit for Approval
              </button>
            ) : null}
            {reviewStatus?.status === "pending" && isHeadOrAdmin ? (
              <button
                onClick={onOpenReview}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.743 7.523 5 12 5c4.478 0 8.268 2.743 9.542 7-1.274 4.257-5.064 7-9.542 7-4.477 0-8.268-2.743-9.542-7z" />
                </svg>
                Review This Post
              </button>
            ) : null}
          </div>
        ) : null}

        {saveError ? (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{saveError}</span>
          </div>
        ) : null}

        {canEdit ? (
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onSave}
              disabled={!post.caption.trim() || !post.date}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:bg-slate-300"
            >
              {post.id ? "Save Changes" : "Plan Post"}
            </button>
            {post.id ? (
              <button
                onClick={onDelete}
                className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100"
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export function PostDetailModal({
  open,
  post,
  canEdit,
  members,
  reviewStatus,
  onClose,
  onEdit,
}: {
  open: boolean;
  post: ContentPost | null;
  canEdit: boolean;
  members: MemberChoice[];
  reviewStatus: { status: string; reviewId: number; feedback: string | null } | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  if (!post) return null;
  const owners = members.filter((m) => post.ownerUserIds.includes(m.id));

  return (
    <Modal open={open} onClose={onClose} title="Post Details">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${PLATFORM_CONFIG[post.platform].color}`}>
            {PLATFORM_CONFIG[post.platform].label}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CONFIG[post.status].classes}`}>
            {STATUS_CONFIG[post.status].label}
          </span>
        </div>

        {(post.date || post.time) && (
          <div className="flex gap-6">
            {post.date && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Date</p>
                <p className="mt-0.5 text-sm font-medium text-slate-800">
                  {new Date(`${post.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
            )}
            {post.time && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Time</p>
                <p className="mt-0.5 text-sm font-medium text-slate-800">{post.time}</p>
              </div>
            )}
          </div>
        )}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Caption</p>
          <p className="mt-1 max-h-40 overflow-y-auto text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{post.caption || "—"}</p>
        </div>

        {post.notes ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notes</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{post.notes}</p>
          </div>
        ) : null}

        {owners.length > 0 ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Owners</p>
            <div className="mt-2 flex items-center gap-2">
              <MemberAvatarStack names={owners.map((o) => o.name)} size="sm" />
              <p className="text-xs text-slate-500">{owners.map((o) => o.name).join(", ")}</p>
            </div>
          </div>
        ) : null}

        {reviewStatus?.status === "approved" ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold">Approved for publishing</span>
            {reviewStatus.feedback ? <span className="text-emerald-600">— {reviewStatus.feedback}</span> : null}
          </div>
        ) : null}
        {reviewStatus?.status === "rejected" ? (
          <div className="flex flex-col gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="font-semibold">Rejected by HEAD</span>
            </div>
            {reviewStatus.feedback ? <p className="pl-6 text-rose-600">{reviewStatus.feedback}</p> : null}
          </div>
        ) : null}
        {reviewStatus?.status === "pending" ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold">Pending approval from HEAD</span>
          </div>
        ) : null}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Close
          </button>
          {canEdit ? (
            <button
              onClick={onEdit}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
            >
              Edit Post
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

export function PostReviewModal({
  open,
  reviewTarget,
  reviewFeedback,
  reviewSaving,
  onClose,
  onFeedbackChange,
  onApprove,
  onReject,
}: {
  open: boolean;
  reviewTarget: { postId: number; reviewId: number; postCaption: string } | null;
  reviewFeedback: string;
  reviewSaving: boolean;
  onClose: () => void;
  onFeedbackChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Review Post">
      {reviewTarget ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
            <p className="text-sm text-slate-500">Post Content</p>
            <p className="mt-1 max-h-48 overflow-y-auto text-sm font-bold text-slate-900 leading-relaxed whitespace-pre-wrap">{reviewTarget.postCaption}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Feedback <span className="text-slate-400">(required for rejection)</span>
            </label>
            <textarea
              value={reviewFeedback}
              onChange={(event) => onFeedbackChange(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
              placeholder="Add feedback or comments..."
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onApprove}
              disabled={reviewSaving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:bg-slate-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {reviewSaving ? "Approving..." : "Approve"}
            </button>
            <button
              onClick={onReject}
              disabled={reviewSaving || !reviewFeedback.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {reviewSaving ? "Rejecting..." : "Reject"}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

const PLATFORMS: Platform[] = ["instagram", "tiktok", "facebook"];
const STATUSES: PostStatus[] = ["draft", "scheduled", "published"];
const APPROVALS: { value: ApprovalStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not_requested", label: "No review" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function PostListView({
  posts,
  members,
  canEdit,
  onOpenPost,
  onEditPost,
}: {
  posts: ContentPost[];
  members: MemberChoice[];
  canEdit: boolean;
  onOpenPost: (post: ContentPost) => void;
  onEditPost?: (post: ContentPost) => void;
}) {
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PostStatus | "all">("all");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalStatus | "all">("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);

  const availableMonths = useMemo(() => {
    const set = new Set(posts.map((p) => p.date.slice(0, 7)).filter(Boolean));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [posts]);

  const filtered = posts
    .filter((p) =>
      (platformFilter === "all" || p.platform === platformFilter) &&
      (statusFilter === "all" || p.status === statusFilter) &&
      (approvalFilter === "all" || p.approvalStatus === approvalFilter) &&
      (monthFilter === "all" || p.date.startsWith(monthFilter)) &&
      (search.trim() === "" || p.caption.toLowerCase().includes(search.trim().toLowerCase()))
    )
    .sort((a, b) => {
      const d = sortDir === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
      return d || a.time.localeCompare(b.time);
    });

  const hasActiveFilters = platformFilter !== "all" || statusFilter !== "all" || approvalFilter !== "all" || monthFilter !== "all" || search.trim() !== "";

  // Reset to the first page whenever the filtered set changes.
  useEffect(() => {
    setPage(1);
  }, [search, platformFilter, statusFilter, approvalFilter, monthFilter, sortDir]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (posts.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/80 px-6 py-16 text-center">
        <p className="text-sm font-semibold text-slate-700">No posts yet</p>
        <p className="mt-1 text-sm text-slate-400">Planned posts will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        {/* Search */}
        <div className="relative w-full">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search captions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
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
            value={platformFilter}
            onValueChange={(v) => setPlatformFilter(v as Platform | "all")}
            options={[
              { value: "all", label: "All platforms" },
              ...PLATFORMS.map((p) => ({ value: p, label: PLATFORM_CONFIG[p].label })),
            ]}
            className="w-full"
          />
          <AppSelect
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as PostStatus | "all")}
            options={[
              { value: "all", label: "All statuses" },
              ...STATUSES.map((s) => ({ value: s, label: STATUS_CONFIG[s].label })),
            ]}
            className="w-full"
          />
          <AppSelect
            value={approvalFilter}
            onValueChange={(v) => setApprovalFilter(v as ApprovalStatus | "all")}
            options={APPROVALS.map(({ value, label }) => ({
              value,
              label: value === "all" ? "All approvals" : label,
            }))}
            className="w-full"
          />
          <AppSelect
            value={monthFilter}
            onValueChange={setMonthFilter}
            options={[
              { value: "all", label: "All months" },
              ...availableMonths.map((m) => ({ value: m, label: formatMonthKey(m) })),
            ]}
            className="w-full"
          />
          <AppSelect
            value={sortDir}
            onValueChange={(v) => setSortDir(v as "asc" | "desc")}
            options={[
              { value: "desc", label: "Date — newest" },
              { value: "asc", label: "Date — oldest" },
            ]}
            className="col-span-2 w-full"
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setSearch(""); setPlatformFilter("all"); setStatusFilter("all"); setApprovalFilter("all"); setMonthFilter("all"); }}
              className="col-span-2 rounded-xl border border-rose-200 bg-rose-50 py-2 text-[11px] font-semibold text-rose-600 transition-colors hover:bg-rose-100"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Desktop: chip buttons */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          {/* Platform chips */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setPlatformFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${platformFilter === "all" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              All
            </button>
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatformFilter(platformFilter === p ? "all" : p)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${platformFilter === p ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                {PLATFORM_SHORT_LABEL[p]}
              </button>
            ))}
          </div>

          {/* Status chips */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${statusFilter === "all" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              All
            </button>
            {STATUSES.map((s) => (
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

          {/* Approval filter */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {APPROVALS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setApprovalFilter(approvalFilter === value ? "all" : (value as ApprovalStatus | "all"))}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${approvalFilter === value ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Month filter */}
          <AppSelect
            value={monthFilter}
            onValueChange={setMonthFilter}
            options={[
              { value: "all", label: "All months" },
              ...availableMonths.map((m) => ({ value: m, label: formatMonthKey(m) })),
            ]}
            className="min-w-[140px]"
          />

          {/* Sort by date */}
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
            title="Toggle date sort direction"
          >
            <svg className={`h-3 w-3 transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
            Date {sortDir === "desc" ? "↓" : "↑"}
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setSearch(""); setPlatformFilter("all"); setStatusFilter("all"); setApprovalFilter("all"); setMonthFilter("all"); }}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600 transition-colors hover:bg-rose-100"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Result count */}
      <p className="px-1 text-[11px] text-slate-400">
        {filtered.length === posts.length
          ? `${posts.length} post${posts.length !== 1 ? "s" : ""}`
          : `${filtered.length} of ${posts.length} posts`}
      </p>

      {/* Table */}
      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-slate-600">No posts match your filters</p>
            <p className="mt-1 text-[13px] text-slate-400">Try adjusting or clearing the filters above.</p>
          </div>
        ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Platform</th>
              <th className="w-full px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Caption</th>
              <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Date</th>
              <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
          {paginated.map((post) => {
            const isRejected = post.approvalStatus === "rejected";
            const ownerNames = post.ownerUserIds.map((id) => memberMap[id]).filter(Boolean);
            const approvalBadge = APPROVAL_STATUS_CONFIG[post.approvalStatus];
            const platformCfg = PLATFORM_CONFIG[post.platform] ?? PLATFORM_CONFIG["instagram"];

            return (
              <tr
                key={post.id}
                onClick={() => onOpenPost(post)}
                className={`group cursor-pointer transition-colors ${
                  isRejected ? "bg-rose-50/60 hover:bg-rose-50" : "hover:bg-violet-50/40"
                }`}
              >
                <td className="whitespace-nowrap px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isRejected ? "border-rose-200 bg-rose-100 text-rose-700" : platformCfg.color}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isRejected ? "bg-rose-500" : platformCfg.dot}`} />
                    {platformCfg.label}
                  </span>
                </td>

                <td className="max-w-0 px-5 py-4">
                  <p className={`truncate text-sm font-medium ${isRejected ? "text-rose-800 line-through decoration-rose-400/60" : "text-slate-800"}`}>
                    {post.caption || "—"}
                  </p>
                  {ownerNames.length > 0 && (
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">{ownerNames.join(", ")}</p>
                  )}
                </td>

                <td className="whitespace-nowrap px-5 py-4">
                  <p className="text-sm font-medium text-slate-700">
                    {post.date
                      ? new Date(`${post.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </p>
                  {post.time && <p className="text-[11px] text-slate-400">{post.time}</p>}
                </td>

                <td className="whitespace-nowrap px-5 py-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CONFIG[post.status].classes}`}>
                      {STATUS_CONFIG[post.status].label}
                    </span>
                    {approvalBadge && (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${approvalBadge.classes}`}>
                        {approvalBadge.label}
                      </span>
                    )}
                  </div>
                </td>

                <td className="whitespace-nowrap px-5 py-4 text-right">
                  {canEdit && onEditPost && !isRejected && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onEditPost(post); }}
                      aria-label="Edit post"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 opacity-0 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 group-hover:opacity-100"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
        )}
      </div>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onPageChange={setPage}
        className="px-1"
      />
    </div>
  );
}
