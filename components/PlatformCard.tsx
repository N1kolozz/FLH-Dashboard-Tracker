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
    gradient: "from-purple-500 via-pink-500 to-orange-400",
    bg: "bg-gradient-to-br from-purple-50 to-pink-50",
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
    gradient: "from-gray-900 to-gray-700",
    bg: "bg-gradient-to-br from-gray-50 to-slate-50",
    border: "border-gray-200",
    textAccent: "text-gray-700",
    badgeBg: "bg-gray-100",
  },
  facebook: {
    label: "Facebook",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    gradient: "from-blue-600 to-blue-400",
    bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
    border: "border-blue-200",
    textAccent: "text-blue-600",
    badgeBg: "bg-blue-100",
  },
} as const;

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
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badgeBg} ${accentColor}`}>
      <span>{isPositive ? "+" : ""}{value.toLocaleString()}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}

export default function PlatformCard({ stats, isLoading }: PlatformCardProps) {
  const config = PLATFORM_CONFIG[stats.platform as keyof typeof PLATFORM_CONFIG];

  if (!config) return null;

  if (isLoading) {
    return (
      <div className={`rounded-2xl border ${config.border} ${config.bg} p-6 shadow-sm`}>
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-200" />
            <div className="h-5 bg-gray-200 rounded w-24" />
          </div>
          <div className="h-10 bg-gray-200 rounded w-32" />
          <div className="flex gap-2">
            <div className="h-6 bg-gray-200 rounded-full w-20" />
            <div className="h-6 bg-gray-200 rounded-full w-20" />
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
            <h3 className="font-semibold text-gray-800">{config.label}</h3>
            {stats.last_updated && (
              <p className="text-xs text-gray-400">
                Updated {new Date(stats.last_updated).toLocaleDateString()}
              </p>
            )}
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
      <div className="mb-4">
        {stats.followers !== null ? (
          <span className="text-4xl font-bold text-gray-900 tracking-tight">
            {stats.followers.toLocaleString()}
          </span>
        ) : (
          <span className="text-2xl font-semibold text-gray-400 italic">
            N/A
          </span>
        )}
        <span className="ml-2 text-sm text-gray-500">followers</span>
      </div>

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
            <span className="text-xs text-gray-400 italic">
              Growth data available after 2+ days of tracking
            </span>
          )}
      </div>
    </div>
  );
}
