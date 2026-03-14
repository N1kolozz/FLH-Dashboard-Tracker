"use client";

import { useState, useEffect, useCallback } from "react";
import PlatformCard from "@/components/PlatformCard";
import GrowthChart from "@/components/GrowthChart";
import CombinedGrowthChart from "@/components/CombinedGrowthChart";
import DashboardStats from "@/components/DashboardStats";
import { StatsResponse } from "@/app/api/stats/route";

const PLATFORMS = ["instagram", "tiktok", "facebook"] as const;
type Platform = (typeof PLATFORMS)[number];
type ChartTab = Platform | "all";

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<ChartTab>("all");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StatsResponse = await res.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch (err) {
      setStatsError(String(err));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function triggerScrape() {
    const key = prompt("Enter CRON_SECRET to trigger scrape:");
    if (!key) return;
    setScraping(true);
    setScrapeResult(null);
    try {
      const res = await fetch(`/api/scrape?key=${encodeURIComponent(key)}`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        setScrapeResult(
          `Scrape complete! Saved: ${json.saved?.join(", ") || "none"}${
            json.errors?.length ? ` | Errors: ${json.errors.join("; ")}` : ""
          }`
        );
        await fetchStats();
      } else {
        setScrapeResult(`Error: ${json.error}`);
      }
    } catch (err) {
      setScrapeResult(`Failed: ${String(err)}`);
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-none">
                FLH Social Dashboard
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Future Leaders Hub · Growth Analytics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="hidden sm:inline text-xs text-gray-400">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={triggerScrape}
              disabled={scraping}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {scraping ? (
                <>
                  <svg
                    className="animate-spin w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Scraping...
                </>
              ) : (
                <>
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
                  Run Scrape
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Scrape Result Toast */}
        {scrapeResult && (
          <div
            className={`rounded-lg px-4 py-3 text-sm flex items-start justify-between gap-3 ${
              scrapeResult.startsWith("Error") || scrapeResult.startsWith("Failed")
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-emerald-50 border border-emerald-200 text-emerald-700"
            }`}
          >
            <span>{scrapeResult}</span>
            <button
              onClick={() => setScrapeResult(null)}
              className="text-current opacity-60 hover:opacity-100 shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Stats Error */}
        {statsError && (
          <div className="rounded-lg px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700">
            Failed to load stats: {statsError}
          </div>
        )}

        {/* Summary Stats Row */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Overview
          </h2>
          <DashboardStats stats={stats} isLoading={loadingStats} />
        </section>

        {/* Platform Cards */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
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
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Growth Charts
            </h2>
            {/* Platform Tab Selector */}
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setActiveChart("all")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeChart === "all"
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                All
              </button>
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setActiveChart(p)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    activeChart === p
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
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
      <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-6 border-t border-gray-100 mt-4">
        <p className="text-xs text-gray-400 text-center">
          Future Leaders Hub Social Media Dashboard · Data collected daily via
          automated scraping
        </p>
      </footer>
    </div>
  );
}
