import type { ContentPostRow } from "@/app/actions/content-posts";
import { normalizeOwnerUserIds } from "@/lib/owner-users";

export type Platform = "instagram" | "tiktok" | "facebook";
export type PostStatus = "draft" | "scheduled" | "published";
export type CalendarLayout = "slide" | "fit";
export type CalendarView = "month" | "week";
export { getMonthDays, MONTHS, WEEKDAYS } from "@/lib/calendar-ui";

export interface ContentPost {
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

export const PLATFORM_CONFIG: Record<
  Platform,
  { label: string; color: string; dot: string }
> = {
  instagram: {
    label: "Instagram",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    dot: "bg-purple-600",
  },
  tiktok: {
    label: "TikTok",
    color: "bg-slate-100 text-slate-700 border-slate-300",
    dot: "bg-slate-400",
  },
  facebook: {
    label: "Facebook",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-600",
  },
};

export const PLATFORM_SHORT_LABEL: Record<Platform, string> = {
  instagram: "IG",
  tiktok: "TT",
  facebook: "FB",
};

export const STATUS_CONFIG: Record<
  PostStatus,
  { label: string; classes: string }
> = {
  draft: { label: "Draft", classes: "bg-slate-100 text-slate-600" },
  scheduled: { label: "Scheduled", classes: "bg-amber-100 text-amber-700" },
  published: { label: "Published", classes: "bg-emerald-100 text-emerald-700" },
};

export const EMPTY_POST: ContentPost = {
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

export function getPostPayload(post: ContentPost) {
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

export function rowToPost(row: ContentPostRow): ContentPost {
  return {
    id: row.id,
    platform: row.platform as Platform,
    caption: row.caption,
    date: row.date,
    time: row.time,
    status: row.status as PostStatus,
    notes: row.notes,
    ownerUserIds: normalizeOwnerUserIds(row.owner_user_ids),
    createdAt: row.created_at,
  };
}

export function sortPosts(items: ContentPost[]) {
  return [...items].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.time.localeCompare(b.time) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
