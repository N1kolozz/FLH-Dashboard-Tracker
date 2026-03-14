"use client";

import { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { HistoryPoint } from "@/app/api/history/route";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const PLATFORM_CONFIG = {
  instagram: {
    border: "rgb(168, 85, 247)",
    background: "rgba(168, 85, 247, 0.08)",
    label: "Instagram",
    iconColor: "#a855f7",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  tiktok: {
    border: "rgb(55, 65, 81)",
    background: "rgba(55, 65, 81, 0.08)",
    label: "TikTok",
    iconColor: "#374151",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
      </svg>
    ),
  },
  facebook: {
    border: "rgb(37, 99, 235)",
    background: "rgba(37, 99, 235, 0.08)",
    label: "Facebook",
    iconColor: "#2563eb",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
} as const;

// Keep PLATFORM_COLORS alias for chart datasets
const PLATFORM_COLORS = PLATFORM_CONFIG;

type Platform = keyof typeof PLATFORM_COLORS;
type TimeRange = "30" | "90" | "all";

const RANGE_LABELS: Record<TimeRange, string> = {
  "30": "Last 30 days",
  "90": "Last 90 days",
  all: "All time",
};

const PLATFORMS: Platform[] = ["instagram", "tiktok", "facebook"];

function mergeDates(allData: Record<Platform, HistoryPoint[]>): string[] {
  const dateSet = new Set<string>();
  for (const platform of PLATFORMS) {
    for (const point of allData[platform]) {
      dateSet.add(point.date);
    }
  }
  return Array.from(dateSet).sort();
}

export default function CombinedGrowthChart() {
  const [allData, setAllData] = useState<Record<Platform, HistoryPoint[]>>({
    instagram: [],
    tiktok: [],
    facebook: [],
  });
  const [range, setRange] = useState<TimeRange>("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setLoading(true);
    setError(null);

    Promise.all(
      PLATFORMS.map((platform) =>
        fetch(`/api/history?platform=${platform}&range=${range}`, { signal })
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json() as Promise<HistoryPoint[]>;
          })
          .then((data) => ({ platform, data }))
      )
    )
      .then((results) => {
        const combined = { instagram: [], tiktok: [], facebook: [] } as Record<
          Platform,
          HistoryPoint[]
        >;
        for (const { platform, data } of results) {
          combined[platform] = data;
        }
        setAllData(combined);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(String(err));
          setLoading(false);
        }
      });
  }, [range]);

  const dates = mergeDates(allData);
  const totalPoints = PLATFORMS.reduce(
    (sum, p) => sum + allData[p].length,
    0
  );

  const chartData = {
    labels: dates.map((d) =>
      new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      })
    ),
    datasets: PLATFORMS.map((platform) => {
      const config = PLATFORM_COLORS[platform];
      const byDate = new Map(
        allData[platform].map((p) => [p.date, p.followers])
      );
      return {
        label: config.label,
        data: dates.map((d) => byDate.get(d) ?? null),
        borderColor: config.border,
        backgroundColor: config.background,
        borderWidth: 2,
        pointRadius: totalPoints > 120 ? 0 : 3,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.4,
        spanGaps: true,
      };
    }),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            if (ctx.parsed.y === null) return "";
            return ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()} followers`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxTicksLimit: 8,
          color: "#9ca3af",
          font: { size: 11 },
        },
      },
      y: {
        grid: { color: "rgba(156,163,175,0.2)" },
        ticks: {
          color: "#9ca3af",
          font: { size: 11 },
          callback: (value: number | string) => {
            const n = Number(value);
            if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
            if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
            return n.toString();
          },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {PLATFORMS.map((p) => (
            <div
              key={p}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: PLATFORM_CONFIG[p].iconColor + "18" }}
            >
              <span style={{ color: PLATFORM_CONFIG[p].iconColor }}>
                {PLATFORM_CONFIG[p].icon}
              </span>
            </div>
          ))}
          <h3 className="font-semibold text-gray-800 ml-1">All Platforms Growth</h3>
        </div>
        {/* Range Selector */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {(Object.entries(RANGE_LABELS) as [TimeRange, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  range === key
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Custom legend with platform icons */}
      <div className="flex items-center gap-5 mb-4">
        {PLATFORMS.map((p) => {
          const cfg = PLATFORM_CONFIG[p];
          return (
            <div key={p} className="flex items-center gap-1.5">
              <div
                className="w-5 h-0.5 rounded-full shrink-0"
                style={{ backgroundColor: cfg.border }}
              />
              <span style={{ color: cfg.iconColor }}>
                {cfg.icon}
              </span>
              <span className="text-xs text-gray-600 font-medium">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Chart Body */}
      <div className="h-64">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
          </div>
        )}
        {!loading && error && (
          <div className="h-full flex items-center justify-center text-sm text-red-400">
            Failed to load chart data
          </div>
        )}
        {!loading && !error && dates.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <svg
              className="w-10 h-10 mb-2 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span className="text-sm">No data yet — run a scrape to start tracking</span>
          </div>
        )}
        {!loading && !error && dates.length > 0 && (
          <Line
            data={chartData}
            options={options as Parameters<typeof Line>[0]["options"]}
          />
        )}
      </div>
    </div>
  );
}
