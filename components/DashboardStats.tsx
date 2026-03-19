"use client";

import { StatsResponse } from "@/app/api/stats/route";

interface DashboardStatsProps {
  stats: StatsResponse | null;
  isLoading?: boolean;
}

function StatBox({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: string | null;
  isLoading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-purple-100 px-5 py-4 shadow-sm text-center">
      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-7 bg-slate-200 rounded w-20 mx-auto mb-1" />
          <div className="h-4 bg-slate-100 rounded w-16 mx-auto" />
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-slate-900">
            {value ?? "N/A"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{label}</div>
        </>
      )}
    </div>
  );
}

function sumGrowth(
  stats: StatsResponse | null,
  field: "daily_growth" | "weekly_growth" | "monthly_growth"
): string | null {
  if (!stats) return null;
  const values = Object.values(stats)
    .map((s) => s[field])
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const total = values.reduce((a, b) => a + b, 0);
  return (total >= 0 ? "+" : "") + total.toLocaleString();
}

function sumPositiveGrowth(
  stats: StatsResponse | null,
  field: "daily_growth" | "weekly_growth" | "monthly_growth"
): string | null {
  if (!stats) return null;
  const values = Object.values(stats)
    .map((s) => s[field])
    .filter((v): v is number => v !== null && v > 0);
  const total = values.reduce((a, b) => a + b, 0);
  return "+" + total.toLocaleString();
}

function totalFollowers(stats: StatsResponse | null): string | null {
  if (!stats) return null;
  const values = Object.values(stats)
    .map((s) => s.followers)
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0).toLocaleString();
}

export default function DashboardStats({
  stats,
  isLoading,
}: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatBox
        label="Total Followers"
        value={totalFollowers(stats)}
        isLoading={isLoading}
      />
      <StatBox
        label="Total Daily Growth"
        value={sumPositiveGrowth(stats, "daily_growth")}
        isLoading={isLoading}
      />
      <StatBox
        label="Total Weekly Growth"
        value={sumGrowth(stats, "weekly_growth")}
        isLoading={isLoading}
      />
      <StatBox
        label="Total Monthly Growth"
        value={sumGrowth(stats, "monthly_growth")}
        isLoading={isLoading}
      />
    </div>
  );
}
