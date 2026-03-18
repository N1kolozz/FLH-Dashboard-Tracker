"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import PlatformCard from "@/components/PlatformCard";
import GrowthChart from "@/components/GrowthChart";
import CombinedGrowthChart from "@/components/CombinedGrowthChart";
import DashboardStats from "@/components/DashboardStats";
import { StatsResponse } from "@/app/api/stats/route";
import { HistoryPoint } from "@/app/api/history/route";

const PLATFORMS = ["instagram", "tiktok", "facebook"] as const;
type Platform = (typeof PLATFORMS)[number];
type ChartTab = Platform | "all";
type TimeRange = "30" | "90" | "all";

interface GrowthHighlight {
  platform: Platform;
  date: string;
  value: number;
}

interface CompareRow {
  platform: Platform;
  currentGrowth: number | null;
  previousGrowth: number | null;
  deltaPercent: number | null;
}

function rangeToDays(range: TimeRange): number {
  if (range === "30") return 30;
  if (range === "90") return 90;
  return 0;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function growthFromHistory(points: HistoryPoint[]): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1].followers - points[0].followers;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<ChartTab>("all");
  const [insightsRange, setInsightsRange] = useState<TimeRange>("30");
  const [compareMode, setCompareMode] = useState(false);
  const [insightsLastUpdated, setInsightsLastUpdated] = useState<Date | null>(
    null
  );
  const [historyByPlatform, setHistoryByPlatform] = useState<
    Record<Platform, HistoryPoint[]>
  >({
    instagram: [],
    tiktok: [],
    facebook: [],
  });
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StatsResponse = await res.json();
      setStats(data);
    } catch (err) {
      setStatsError(String(err));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    let cancelled = false;
    setInsightsLoading(true);
    setInsightsError(null);

    const loadInsights = async () => {
      try {
        const currentResults = await Promise.all(
          PLATFORMS.map(async (platform) => {
            const res = await fetch(
              `/api/history?platform=${platform}&range=${insightsRange}`,
              { cache: "no-store" }
            );
            if (!res.ok) throw new Error(`History ${platform}: HTTP ${res.status}`);
            const data: HistoryPoint[] = await res.json();
            return { platform, data };
          })
        );

        const nextHistory = {
          instagram: [],
          tiktok: [],
          facebook: [],
        } as Record<Platform, HistoryPoint[]>;
        currentResults.forEach(({ platform, data }) => {
          nextHistory[platform] = data;
        });
        if (!cancelled) setHistoryByPlatform(nextHistory);
        if (!cancelled) setInsightsLastUpdated(new Date());

        if (compareMode && insightsRange !== "all") {
          const days = rangeToDays(insightsRange);
          const today = new Date();
          const currentStart = new Date(today);
          currentStart.setDate(today.getDate() - (days - 1));
          const previousEnd = new Date(currentStart);
          previousEnd.setDate(currentStart.getDate() - 1);
          const previousStart = new Date(previousEnd);
          previousStart.setDate(previousEnd.getDate() - (days - 1));

          const previousResults = await Promise.all(
            PLATFORMS.map(async (platform) => {
              const res = await fetch(
                `/api/history?platform=${platform}&start=${ymd(previousStart)}&end=${ymd(previousEnd)}`,
                { cache: "no-store" }
              );
              if (!res.ok) throw new Error(`Compare ${platform}: HTTP ${res.status}`);
              const data: HistoryPoint[] = await res.json();
              return { platform, data };
            })
          );

          const rows: CompareRow[] = PLATFORMS.map((platform) => {
            const current = growthFromHistory(nextHistory[platform]);
            const previous = growthFromHistory(
              previousResults.find((r) => r.platform === platform)?.data ?? []
            );
            const deltaPercent =
              current !== null && previous !== null && previous !== 0
                ? ((current - previous) / Math.abs(previous)) * 100
                : null;
            return {
              platform,
              currentGrowth: current,
              previousGrowth: previous,
              deltaPercent:
                deltaPercent === null ? null : Number(deltaPercent.toFixed(1)),
            };
          });
          if (!cancelled) setCompareRows(rows);
        } else if (!cancelled) {
          setCompareRows([]);
        }
      } catch (err) {
        if (!cancelled) {
          setInsightsError(String(err));
        }
      } finally {
        if (!cancelled) setInsightsLoading(false);
      }
    };

    loadInsights();
    return () => {
      cancelled = true;
    };
  }, [insightsRange, compareMode]);

  async function exportCsv() {
    try {
      const res = await fetch(`/api/report?range=${insightsRange}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flh-report-${insightsRange}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setInsightsError(`CSV export failed: ${String(err)}`);
    }
  }

  const dropAlerts = PLATFORMS.filter(
    (platform) => (stats?.[platform]?.daily_growth ?? 0) < 0
  ).map((platform) => ({
    platform,
    value: stats?.[platform]?.daily_growth ?? 0,
  }));

  const bestDay: GrowthHighlight | null = (() => {
    let best: GrowthHighlight | null = null;
    for (const platform of PLATFORMS) {
      const points = historyByPlatform[platform];
      for (let i = 1; i < points.length; i++) {
        const growth = points[i].followers - points[i - 1].followers;
        if (!best || growth > best.value) {
          best = { platform, date: points[i].date, value: growth };
        }
      }
    }
    return best;
  })();

  const bestWeek: GrowthHighlight | null = (() => {
    let best: GrowthHighlight | null = null;
    for (const platform of PLATFORMS) {
      const points = historyByPlatform[platform];
      for (let i = 7; i < points.length; i++) {
        const growth = points[i].followers - points[i - 7].followers;
        if (!best || growth > best.value) {
          best = { platform, date: points[i].date, value: growth };
        }
      }
    }
    return best;
  })();

  function deltaClass(deltaPercent: number | null): string {
    if (deltaPercent === null) return "bg-slate-100 text-slate-600";
    if (deltaPercent > 0) return "bg-purple-100 text-purple-700";
    if (deltaPercent < 0) return "bg-rose-100 text-rose-700";
    return "bg-slate-100 text-slate-600";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-purple-200/70 bg-gradient-to-r from-violet-100/70 via-purple-100/65 to-fuchsia-100/70 backdrop-blur-md shadow-[0_8px_30px_rgba(124,58,237,0.10)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/flhlogo.svg"
              alt="FLH logo"
              width={36}
              height={36}
              className="w-9 h-9 rounded-xl shadow-sm object-cover"
              priority
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-none truncate">
                FLH Social Dashboard
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                Future Leaders Hub
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportCsv}
              title="Export CSV"
              aria-label="Export CSV"
              className="flex items-center justify-center sm:justify-start gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/90 border border-purple-200 hover:bg-white text-purple-700 text-sm font-medium rounded-lg transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Stats Error */}
        {statsError && (
          <div className="rounded-lg px-4 py-3 text-sm bg-rose-50 border border-rose-200 text-rose-700">
            Failed to load stats: {statsError}
          </div>
        )}

        {/* Alerts */}
        {dropAlerts.length > 0 && (
          <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-sm font-semibold text-rose-700 mb-1">
              Follower drop alert
            </p>
            <div className="text-sm text-rose-700">
              {dropAlerts.map((alert) => (
                <span key={alert.platform} className="mr-4 capitalize">
                  {alert.platform}: {alert.value}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Insights */}
        <section className="bg-white rounded-2xl border border-purple-100 shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
              Insights
            </h2>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {insightsLastUpdated && (
                <span className="text-xs text-slate-500">
                  Insights updated {insightsLastUpdated.toLocaleTimeString()}
                </span>
              )}
              <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                {(["30", "90", "all"] as TimeRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setInsightsRange(r)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      insightsRange === r
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {r === "all" ? "All time" : `${r} days`}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCompareMode((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  compareMode
                    ? "bg-purple-50 border-purple-200 text-purple-700"
                    : "bg-white border-slate-200 text-slate-600"
                }`}
              >
                Compare mode {compareMode ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          {insightsError && (
            <div className="mb-4 rounded-lg px-3 py-2 text-sm bg-rose-50 border border-rose-200 text-rose-700">
              Failed to load insights: {insightsError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                Best Growth Day
              </p>
              {insightsLoading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : bestDay ? (
                <>
                  <p className="text-lg font-bold text-slate-900">
                    +{bestDay.value.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-600 capitalize">
                    {bestDay.platform} · {bestDay.date}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">Not enough data yet</p>
              )}
            </div>

            <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                Best Growth Week
              </p>
              {insightsLoading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : bestWeek ? (
                <>
                  <p className="text-lg font-bold text-slate-900">
                    +{bestWeek.value.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-600 capitalize">
                    {bestWeek.platform} · ending {bestWeek.date}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">Not enough data yet</p>
              )}
            </div>

          </div>

          {compareMode && insightsRange !== "all" && (
            <div className="mt-4 rounded-xl border border-purple-100 overflow-hidden">
              <div className="px-4 py-2 bg-purple-50/50 text-xs text-slate-500 uppercase tracking-wide">
                Compare current range vs previous period
              </div>
              <div className="divide-y divide-purple-100">
                {compareRows.map((row) => (
                  <div
                    key={row.platform}
                    className="px-4 py-2 text-sm flex items-center justify-between"
                  >
                    <span className="capitalize text-slate-600">{row.platform}</span>
                    <span className="text-slate-800 flex items-center gap-2">
                      <span>
                        {row.currentGrowth !== null ? `${row.currentGrowth >= 0 ? "+" : ""}${row.currentGrowth}` : "N/A"}
                        {" vs "}
                        {row.previousGrowth !== null ? `${row.previousGrowth >= 0 ? "+" : ""}${row.previousGrowth}` : "N/A"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${deltaClass(
                          row.deltaPercent
                        )}`}
                      >
                        {row.deltaPercent !== null
                          ? `${row.deltaPercent >= 0 ? "+" : ""}${row.deltaPercent}%`
                          : "N/A"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Summary Stats Row */}
        <section>
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
            Overview
          </h2>
          <DashboardStats stats={stats} isLoading={loadingStats} />
        </section>

        {/* Platform Cards */}
        <section>
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
            By Platform
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLATFORMS.map((platform) => (
              <PlatformCard
                key={platform}
                stats={
                  stats?.[platform] ?? {
                    platform,
                    name: platform,
                    url: "#",
                    followers: null,
                    total_likes: null,
                    posts_count: null,
                    daily_growth: null,
                    weekly_growth: null,
                    monthly_growth: null,
                    last_updated: null,
                    scraped_at: null,
                  }
                }
                isLoading={loadingStats}
              />
            ))}
          </div>
        </section>

        {/* Growth Charts */}
        <section className="min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
              Growth Charts
            </h2>
            {/* Platform Tab Selector */}
            <div className="flex w-full sm:w-auto overflow-x-auto bg-slate-100 rounded-lg p-0.5 gap-0.5 whitespace-nowrap">
              <button
                onClick={() => setActiveChart("all")}
                className={`shrink-0 px-2.5 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors ${
                  activeChart === "all"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                All
              </button>
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setActiveChart(p)}
                  className={`shrink-0 px-2.5 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-medium capitalize transition-colors ${
                    activeChart === p
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          {activeChart === "all" ? (
            <CombinedGrowthChart />
          ) : (
            <GrowthChart platform={activeChart} />
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-6 border-t border-purple-100 mt-4">
        <p className="text-xs text-slate-500 text-center">
          Future Leaders Hub Social Media Dashboard · Data collected daily via
          automated scraping
        </p>
      </footer>
    </div>
  );
}
