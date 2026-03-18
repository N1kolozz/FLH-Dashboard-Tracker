"use client";

import { PlatformStats } from "@/app/api/stats/route";

const PLATFORM_CONFIG = {
  instagram: {
    label: "Instagram",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
    gradient: "from-violet-600 to-purple-500",
    bg: "bg-gradient-to-br from-purple-50 to-violet-50/50",
    border: "border-purple-200",
    textAccent: "text-purple-600",
    badgeBg: "bg-purple-100",
  },
  tiktok: {
    label: "TikTok",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
      </svg>
    ),
    gradient: "from-slate-800 to-slate-600",
    bg: "bg-gradient-to-br from-slate-50 to-purple-50/30",
    border: "border-purple-200",
    textAccent: "text-purple-600",
    badgeBg: "bg-purple-100",
  },
  facebook: {
    label: "Facebook",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    gradient: "from-violet-600 to-purple-500",
    bg: "bg-gradient-to-br from-purple-50/80 to-violet-50/50",
    border: "border-purple-200",
    textAccent: "text-purple-600",
    badgeBg: "bg-purple-100",
  },
} as const;

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getTrend(weeklyGrowth: number | null): {
  label: "Up" | "Flat" | "Down";
  icon: "up" | "flat" | "down";
  classes: string;
} {
  if (weeklyGrowth === null) {
    return { label: "Flat", icon: "flat", classes: "bg-slate-100 text-slate-600 border border-slate-200" };
  }
  if (weeklyGrowth > 0) {
    return { label: "Up", icon: "up", classes: "bg-purple-100 text-purple-700 border border-purple-200" };
  }
  if (weeklyGrowth < 0) {
    return { label: "Down", icon: "down", classes: "bg-rose-100 text-rose-700 border border-rose-200" };
  }
  return { label: "Flat", icon: "flat", classes: "bg-slate-100 text-slate-600 border border-slate-200" };
}

function TrendBadge({
  label,
  icon,
  classes,
}: {
  label: "Up" | "Flat" | "Down";
  icon: "up" | "flat" | "down";
  classes: string;
}) {
  return (
    <span
      title={`Trend: ${label}`}
      aria-label={`Trend: ${label}`}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${classes}`}
    >
      {icon === "up" && (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 14l5-5 5 5" />
        </svg>
      )}
      {icon === "down" && (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l5 5 5-5" />
        </svg>
      )}
      {icon === "flat" && (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12" />
        </svg>
      )}
    </span>
  );
}

interface PlatformCardProps {
  stats: PlatformStats;
  isLoading?: boolean;
}

function GrowthBadge({
  value,
  label,
  accentColor,
  badgeBg,
}: {
  value: number | null;
  label: string;
  accentColor: string;
  badgeBg: string;
}) {
  if (value === null) return null;
  const isPositive = value >= 0;
  const isNegative = value < 0;
  const badgeClasses = isNegative
    ? "bg-rose-100 text-rose-700"
    : `${badgeBg} ${accentColor}`;
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badgeClasses}`}>
      <span>{isPositive ? "+" : ""}{value.toLocaleString()}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}

export default function PlatformCard({ stats, isLoading }: PlatformCardProps) {
  const config = PLATFORM_CONFIG[stats.platform as keyof typeof PLATFORM_CONFIG];
  const trend = getTrend(stats.weekly_growth);

  if (!config) return null;

  if (isLoading) {
    return (
      <div className={`rounded-2xl border ${config.border} ${config.bg} p-6 shadow-sm`}>
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200" />
            <div className="h-5 bg-slate-200 rounded w-24" />
          </div>
          <div className="h-10 bg-slate-200 rounded w-32" />
          <div className="flex gap-2">
            <div className="h-6 bg-slate-200 rounded-full w-20" />
            <div className="h-6 bg-slate-200 rounded-full w-20" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border ${config.border} ${config.bg} p-6 shadow-sm hover:shadow-md transition-shadow duration-200`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} text-white flex items-center justify-center shadow-sm`}
          >
            {config.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800">{config.label}</h3>
              <TrendBadge label={trend.label} icon={trend.icon} classes={trend.classes} />
            </div>
            {stats.scraped_at ? (
              <p className="text-xs text-slate-500">
                Scraped {timeAgo(stats.scraped_at)}
              </p>
            ) : stats.last_updated ? (
              <p className="text-xs text-slate-500">
                Updated {new Date(stats.last_updated).toLocaleDateString()}
              </p>
            ) : null}
          </div>
        </div>
        <a
          href={stats.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs ${config.textAccent} hover:underline font-medium`}
        >
          View →
        </a>
      </div>

      {/* Follower Count */}
      <div className="mb-3">
        {stats.followers !== null ? (
          <span className="text-4xl font-bold text-slate-900 tracking-tight">
            {stats.followers.toLocaleString()}
          </span>
        ) : (
          <span className="text-2xl font-semibold text-slate-400 italic">
            N/A
          </span>
        )}
        <span className="ml-2 text-sm text-slate-500">followers</span>
      </div>

      {/* Profile-level: total likes & posts/videos */}
      {(stats.total_likes != null || stats.posts_count != null) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-sm text-slate-600">
          {stats.total_likes != null && (
            <span>
              <span className="font-medium text-slate-800">{stats.total_likes.toLocaleString()}</span>
              <span className="ml-1 text-slate-500">likes</span>
            </span>
          )}
          {stats.posts_count != null && (
            <span>
              <span className="font-medium text-slate-800">{stats.posts_count.toLocaleString()}</span>
              <span className="ml-1 text-slate-500">
                {stats.platform === "tiktok" ? "videos" : "posts"}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Growth Badges */}
      <div className="flex flex-wrap gap-2">
        <GrowthBadge
          value={stats.daily_growth}
          label="today"
          accentColor={config.textAccent}
          badgeBg={config.badgeBg}
        />
        <GrowthBadge
          value={stats.weekly_growth}
          label="this week"
          accentColor={config.textAccent}
          badgeBg={config.badgeBg}
        />
        <GrowthBadge
          value={stats.monthly_growth}
          label="this month"
          accentColor={config.textAccent}
          badgeBg={config.badgeBg}
        />
        {stats.daily_growth === null &&
          stats.weekly_growth === null &&
          stats.monthly_growth === null && (
            <span className="text-xs text-slate-500 italic">
              Growth data available after 2+ days of tracking
            </span>
          )}
      </div>
    </div>
  );
}
