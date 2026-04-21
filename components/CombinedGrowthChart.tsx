"use client";

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
import type {
  HistoryPoint,
  SocialHistoryRange,
  SocialPlatform,
} from "@/lib/queries/social";
import { Icons } from "@/components/Icons";

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
    icon: Icons.instagram,
  },
  tiktok: {
    border: "rgb(55, 65, 81)",
    background: "rgba(55, 65, 81, 0.08)",
    label: "TikTok",
    iconColor: "#374151",
    icon: Icons.tiktok,
  },
  facebook: {
    border: "rgb(37, 99, 235)",
    background: "rgba(37, 99, 235, 0.08)",
    label: "Facebook",
    iconColor: "#2563eb",
    icon: Icons.facebook,
  },
} as const;

// Keep PLATFORM_COLORS alias for chart datasets
const PLATFORM_COLORS = PLATFORM_CONFIG;

type Platform = keyof typeof PLATFORM_COLORS;
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

export default function CombinedGrowthChart({
  allData,
  rangeLabel,
  loading = false,
  error = null,
}: {
  allData: Record<SocialPlatform, HistoryPoint[]>;
  rangeLabel: SocialHistoryRange;
  loading?: boolean;
  error?: string | null;
}) {
  const dates = mergeDates(allData as Record<Platform, HistoryPoint[]>);
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
    <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-4 sm:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
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
          <h3 className="font-semibold text-slate-800 ml-1 leading-tight">
            All Platforms Growth
          </h3>
        </div>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 sm:text-xs">
          {rangeLabel === "all" ? "All time" : `Last ${rangeLabel} days`}
        </span>
      </div>

      {/* Custom legend with platform icons */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
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
              <span className="text-xs text-slate-600 font-medium">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Chart Body */}
      <div className="h-56 sm:h-64">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full" />
          </div>
        )}
        {!loading && error && (
          <div className="h-full flex items-center justify-center text-sm text-rose-500">
            Failed to load chart data
          </div>
        )}
        {!loading && !error && dates.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
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
