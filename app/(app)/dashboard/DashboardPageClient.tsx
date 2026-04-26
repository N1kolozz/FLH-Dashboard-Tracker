"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { generateDailyBriefing } from "@/app/actions/ai";
import {
  createNewsPost,
  getDashboardNews,
  type DashboardNewsItem,
  type DashboardNewsType,
} from "@/app/actions/news";
import Modal from "@/components/Modal";
import PushNotificationManager from "@/components/PushNotificationManager";
import { canPublishNews } from "@/lib/permissions";
import type { Session } from "@/lib/auth";
import type { DashboardCounts } from "@/app/actions/dashboard-stats";
import type { StatsResponse } from "@/lib/queries/social";
import { Icons } from "@/components/Icons";

const dashboardNumberFormatter = new Intl.NumberFormat("en-US");
const dashboardDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/* ─── Quick-stat card ─── */
function QuickStat({
  label,
  value,
  icon,
  color,
  href,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-purple-100 bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:border-purple-200 hover:bg-slate-50 hover:shadow-xl hover:shadow-purple-100/60"
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3`}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        </div>
      </div>
    </Link>
  );
}

const NEWS_CONFIG: Record<
  DashboardNewsType,
  {
    label: string;
    badge: string;
    icon: React.ReactNode;
  }
> = {
  announcement: {
    label: "Team News",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M11 5.882V19.24a1.76 1.76 0 01-1.105-.385l-3.63-2.904A2 2 0 005 15.511H4a2 2 0 01-2-2v-3.022a2 2 0 012-2h1a2 2 0 001.265-.44l3.63-2.904A1.76 1.76 0 0111 4.76v1.122zm8.5 4.118a4.5 4.5 0 010 4.999M17 8a2.5 2.5 0 010 4.999" />
      </svg>
    ),
  },
  event: {
    label: "Event",
    badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  project: {
    label: "Project",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  review: {
    label: "Needs Review",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

function formatNewsDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return dashboardDateFormatter.format(date);
}

function formatDashboardNumber(value: number) {
  return dashboardNumberFormatter.format(value);
}

function NewsItem({ item }: { item: DashboardNewsItem }) {
  const config = { ...NEWS_CONFIG[item.type] };
  let className = "dash-news-card block h-full rounded-lg border bg-white/95 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:bg-purple-50/60 hover:shadow-lg hover:shadow-purple-100/60 ";
  
  if (item.type === "review") {
    if (item.review_status === "approved") {
      config.label = "Review Approved";
      config.badge = "bg-emerald-100 text-emerald-700 border-emerald-200";
      className += "border-emerald-200 hover:border-emerald-300";
    } else if (item.review_status === "rejected") {
      config.label = "Review Rejected";
      config.badge = "bg-rose-100 text-rose-700 border-rose-200";
      className += "border-rose-200 hover:border-rose-300";
    } else {
      className += "border-amber-200 hover:border-amber-300";
      config.label = "Needs Review";
    }
  } else {
    className += "border-purple-100 hover:border-purple-300";
  }

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${config.badge}`}
        >
          {config.icon}
          {config.label}
        </div>
        <span className="shrink-0 text-xs font-medium text-slate-400">
          {formatNewsDate(item.created_at)}
        </span>
      </div>
      <h3 className="mt-3 text-base font-bold text-slate-900">{item.title}</h3>
      {item.body && (
        <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-purple-50 pt-3">
        <p className="min-w-0 truncate text-xs font-medium text-purple-700">
          {item.meta || "FLH update"}
        </p>
        {(item.href && item.review_status === "pending") && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600">
            Open
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        )}
      </div>
    </>
  );

  if (item.href && item.review_status === "pending") {
    return (
      <Link href={item.href} className={className}>
        {content}
      </Link>
    );
  }

  return <article className={className}>{content}</article>;
}

export default function DashboardPage({
  initialSession,
  initialCounts,
  initialStats,
  initialNewsItems,
  initialReviewItems,
  initialNewsError,
}: {
  initialSession: Session | null;
  initialCounts: DashboardCounts;
  initialStats: StatsResponse;
  initialNewsItems: DashboardNewsItem[];
  initialReviewItems: DashboardNewsItem[];
  initialNewsError: string;
}) {
  const [session] = useState<Session | null>(initialSession);
  const [projectCount] = useState(initialCounts.projectCount);
  const [inventoryCount] = useState(initialCounts.inventoryCount);
  const [eventCount] = useState(initialCounts.eventCount);
  const [expenseTotal] = useState(initialCounts.expenseTotal);
  const [teamCount] = useState(initialCounts.teamCount);
  const [newsItems, setNewsItems] = useState<DashboardNewsItem[]>(initialNewsItems);
  const [reviewItems, setReviewItems] = useState<DashboardNewsItem[]>(initialReviewItems);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(initialNewsError);
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [newsForm, setNewsForm] = useState({ title: "", body: "" });
  const [newsSaving, setNewsSaving] = useState(false);

  // Daily Briefing State (cached in localStorage, 1 request per day per user)
  const BRIEFING_KEY = `flh_daily_briefing_${initialSession?.userId || 'anon'}`;
  const [dailyBriefing, setDailyBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingChecked, setBriefingChecked] = useState(false);

  // On mount, check localStorage for today's cached briefing
  useEffect(() => {
    try {
      const cached = localStorage.getItem(BRIEFING_KEY);
      if (cached) {
        const { date, text } = JSON.parse(cached);
        const today = new Date().toISOString().slice(0, 10);
        if (date === today && text) {
          setDailyBriefing(text);
        }
      }
    } catch {}
    setBriefingChecked(true);
  }, [BRIEFING_KEY]);

  const handleGenerateBriefing = async () => {
    setBriefingLoading(true);
    const res = await generateDailyBriefing();
    if (res.success && res.briefing) {
      setDailyBriefing(res.briefing);
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(BRIEFING_KEY, JSON.stringify({ date: today, text: res.briefing }));
    } else {
      setDailyBriefing(null);
    }
    setBriefingLoading(false);
  };

  const userCanPublishNews = canPublishNews(session);

  const values = Object.values(initialStats);
  const totalFollowers = formatDashboardNumber(
    values
      .map((item) => item.followers)
      .filter((value): value is number => value !== null)
      .reduce((sum, value) => sum + value, 0)
  );
  const followerGrowthValue = values
    .map((item) => item.daily_growth)
    .filter((value): value is number => value !== null)
    .reduce((sum, value) => sum + value, 0);
  const followerGrowth =
    followerGrowthValue >= 0
      ? `+${formatDashboardNumber(followerGrowthValue)}`
      : formatDashboardNumber(followerGrowthValue);

  const loadNews = async () => {
    setNewsLoading(true);
    const result = await getDashboardNews();
    if ("news" in result) {
      setNewsItems(result.news ?? []);
      setReviewItems((result as { reviewItems?: DashboardNewsItem[] }).reviewItems ?? []);
      setNewsError("");
    } else if ("error" in result) {
      setNewsError(result.error ?? "Failed to fetch news");
    }
    setNewsLoading(false);
  };

  const submitNews = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newsForm.title.trim() || newsSaving) return;

    setNewsSaving(true);
    setNewsError("");
    const result = await createNewsPost({
      title: newsForm.title,
      body: newsForm.body,
    });
    setNewsSaving(false);

    if ("success" in result && result.success) {
      setNewsForm({ title: "", body: "" });
      setNewsModalOpen(false);
      await loadNews();
      return;
    }

    if ("error" in result) {
      setNewsError(result.error ?? "Failed to create news post");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(216,180,254,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.14),transparent_28%)]" />
      <div className="pointer-events-none absolute -top-16 left-[7%] h-56 w-56 rounded-full bg-purple-300/18 blur-3xl" />
      <div className="pointer-events-none absolute top-72 right-[10%] h-64 w-64 rounded-full bg-fuchsia-300/14 blur-3xl" />
      <div className="pointer-events-none absolute bottom-12 left-1/3 h-52 w-52 rounded-full bg-cyan-200/16 blur-3xl" />

      <header className="relative border-b border-purple-200/70 bg-gradient-to-r from-violet-100/70 via-purple-100/65 to-fuchsia-100/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            Welcome back
            <span className="text-purple-500 drop-shadow-sm">
              {Icons.wave}
            </span>
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Here&apos;s an overview of Future Leaders Hub operations
          </p>
        </div>
      </header>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <PushNotificationManager
          variant="dashboard"
          canSendTest={session?.role?.toUpperCase() === "ADMIN"}
        />

        {/* Daily Briefing AI Widget */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-r from-orange-50/80 via-amber-50/50 to-yellow-50/80 p-5 sm:p-6 shadow-[0_4px_20px_-4px_rgba(251,191,36,0.15)]">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl" />
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-inner">
              <span className="[&>svg]:h-6 [&>svg]:w-6">{Icons.ai}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                  Daily AI Briefing
                  {briefingLoading && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  )}
                </h2>
                {dailyBriefing && (
                  <span className="text-xs text-amber-600/60 font-medium">დღეს უკვე შეიქმნა ✓</span>
                )}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-amber-800/90">
                {(briefingLoading || !briefingChecked) ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 w-3/4 rounded bg-amber-200/50"></div>
                    <div className="h-4 w-1/2 rounded bg-amber-200/50"></div>
                  </div>
                ) : dailyBriefing ? (
                  <p className="font-medium">{dailyBriefing}</p>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <p className="text-amber-700/70">დააჭირეთ ღილაკს დღიური ბრიფინგის შესაქმნელად.</p>
                    <button
                      type="button"
                      onClick={handleGenerateBriefing}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:from-amber-600 hover:to-orange-600 active:scale-95"
                    >
                      Generate
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <section>
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
            At a Glance
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickStat
              label="Total Followers"
              value={totalFollowers}
              href="/social"
              color="bg-purple-100 text-purple-600"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              }
            />
            <QuickStat
              label="Active Projects"
              value={String(projectCount)}
              href="/projects/overview"
              color="bg-blue-100 text-blue-600"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
            <QuickStat
              label="Inventory Items"
              value={String(inventoryCount)}
              href="/logistics/inventory"
              color="bg-emerald-100 text-emerald-600"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
            />
            <QuickStat
              label="Upcoming Events"
              value={String(eventCount)}
              href="/events"
              color="bg-amber-100 text-amber-600"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />
          </div>
        </section>

        {/* Second row — smaller stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-purple-100 bg-white p-4 text-center shadow-sm">
            <p className="text-xl font-bold text-slate-900">{followerGrowth}</p>
            <p className="text-xs text-slate-500 mt-0.5">Today&apos;s Growth</p>
          </div>
          <div className="rounded-xl border border-purple-100 bg-white p-4 text-center shadow-sm">
            <p className="text-xl font-bold text-slate-900">
              {expenseTotal > 0 ? `₾${formatDashboardNumber(expenseTotal)}` : "₾0"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Expenses This Month</p>
          </div>
          <div className="rounded-xl border border-purple-100 bg-white p-4 text-center shadow-sm">
            <p className="text-xl font-bold text-slate-900">{teamCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Team Members</p>
          </div>
        </section>

        <section className="min-h-0 overflow-hidden rounded-lg border border-purple-200 bg-gradient-to-br from-white via-purple-50/70 to-fuchsia-50/60 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
                News
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Latest updates
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Fresh updates for everyone in the hub.
              </p>
            </div>
            {userCanPublishNews && (
              <button
                type="button"
                onClick={() => setNewsModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Post update
              </button>
            )}
          </div>

          {newsError && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {newsError}
            </div>
          )}

          <div className="mt-4 -mx-1 max-h-[clamp(380px,24vh,320px)] min-h-0 overflow-y-auto px-1 py-1 overscroll-contain">
            {/* Pending review alerts for HEAD/ADMIN */}
            {reviewItems.length > 0 && userCanPublishNews && (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Review Activity ({reviewItems.filter(i => i.review_status === 'pending').length} pending)
                </p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {reviewItems.map((item) => (
                    <div key={item.id}>
                      <NewsItem item={item} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {newsLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="rounded-lg border border-purple-100 bg-white p-4">
                    <div className="h-5 w-28 rounded bg-purple-100" />
                    <div className="mt-4 h-4 w-2/3 rounded bg-slate-100" />
                    <div className="mt-3 h-3 w-full rounded bg-slate-100" />
                    <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : newsItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {newsItems.map((item) => (
                  <div key={item.id}>
                    <NewsItem item={item} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-purple-200 bg-white/80 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-slate-700">No news yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  New events and projects will land here automatically.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={newsModalOpen}
        onClose={() => setNewsModalOpen(false)}
        title="Post News"
        maxWidth="max-w-xl"
      >
        <form onSubmit={submitNews} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Title
            </label>
            <input
              value={newsForm.title}
              onChange={(event) =>
                setNewsForm((current) => ({ ...current, title: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm text-slate-700 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
              placeholder="What should the team know?"
              maxLength={255}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Message
            </label>
            <textarea
              value={newsForm.body}
              onChange={(event) =>
                setNewsForm((current) => ({ ...current, body: event.target.value }))
              }
              className="mt-1 min-h-32 w-full resize-y rounded-lg border border-purple-200 px-3 py-2 text-sm text-slate-700 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
              placeholder="Add the details members need."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewsModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={newsSaving || !newsForm.title.trim()}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {newsSaving ? "Posting..." : "Post update"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
