"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import PlatformCard from "@/components/PlatformCard";
import DashboardStats from "@/components/DashboardStats";
import type {
  HistoryPoint,
  SocialHistoryRange,
  SocialPlatform,
  StatsResponse,
} from "@/lib/queries/social";

const GrowthChart = dynamic(() => import("@/components/GrowthChart"), {
  ssr: false,
});
const CombinedGrowthChart = dynamic(
  () => import("@/components/CombinedGrowthChart"),
  { ssr: false }
);

const PLATFORMS: SocialPlatform[] = ["instagram", "tiktok", "facebook"];
type Platform = (typeof PLATFORMS)[number];
type ChartTab = Platform | "all";
type TimeRange = SocialHistoryRange;

interface GrowthHighlight {
  platform: Platform;
  date: string;
  value: number;
}

function formatSignedInteger(value: number): string {
  if (value === 0) return "0";
  const formatted = Math.abs(value).toLocaleString();
  return `${value > 0 ? "+" : "-"}${formatted}`;
}


export default function DashboardPage({
  initialStats,
  initialHistoryByPlatform,
  initialGeneratedAt,
}: {
  initialStats: StatsResponse;
  initialHistoryByPlatform: Record<SocialPlatform, HistoryPoint[]>;
  initialGeneratedAt: string;
}) {
  const [stats] = useState<StatsResponse>(initialStats);
  const [loadingStats] = useState(false);
  const [statsError] = useState<string | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [activeChart, setActiveChart] = useState<ChartTab>("all");
  const [insightsRange, setInsightsRange] = useState<TimeRange>("30");
  const [insightsLastUpdated, setInsightsLastUpdated] = useState<Date | null>(
    new Date(initialGeneratedAt)
  );
  const [historyByPlatform, setHistoryByPlatform] = useState<Record<Platform, HistoryPoint[]>>(
    initialHistoryByPlatform
  );
  const didHydrateRangeRef = useRef(false);

  useEffect(() => {
    if (!didHydrateRangeRef.current) {
      didHydrateRangeRef.current = true;
      return;
    }

    let cancelled = false;
    setInsightsLoading(true);
    setInsightsError(null);

    const loadInsights = async () => {
      try {
        const currentResults = await Promise.all(
          PLATFORMS.map(async (platform) => {
            const res = await fetch(
              `/api/history?platform=${platform}&range=${insightsRange}`,
              { cache: "default" }
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
        if (!cancelled) {
          setHistoryByPlatform(nextHistory);
          setInsightsLastUpdated(new Date());
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
  }, [insightsRange]);

  async function exportCsv() {
    try {
      const res = await fetch(`/api/report?range=${insightsRange}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flhub-report-${insightsRange}.csv`;
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <header className="z-10 border-b border-purple-200 bg-gradient-to-r from-violet-100 via-purple-100 to-fuchsia-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-none truncate flex items-center gap-2">
              Social Media Analytics
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
              Instagram · TikTok · Facebook
            </p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <button
              onClick={exportCsv}
              title="Export CSV"
              aria-label="Export CSV"
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-white/90 px-4 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-white sm:w-auto sm:justify-start"
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
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${insightsRange === r
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    {r === "all" ? "All time" : `${r} days`}
                  </button>
                ))}
              </div>
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
                    {formatSignedInteger(bestDay.value)}
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
                    {formatSignedInteger(bestWeek.value)}
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
                className={`shrink-0 px-2.5 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors ${activeChart === "all"
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
                  className={`shrink-0 px-2.5 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-medium capitalize transition-colors ${activeChart === p
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
            <CombinedGrowthChart
              allData={historyByPlatform}
              rangeLabel={insightsRange}
              loading={insightsLoading}
              error={insightsError}
            />
          ) : (
            <GrowthChart
              platform={activeChart}
              data={historyByPlatform[activeChart]}
              rangeLabel={insightsRange}
              loading={insightsLoading}
              error={insightsError}
            />
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-6 border-t border-purple-100 mt-4">
        <p className="text-xs text-slate-500 text-center">
          FLHUB Social Media Dashboard · Data collected daily via
          automated scraping
        </p>
      </footer>
    </div>
  );
}
