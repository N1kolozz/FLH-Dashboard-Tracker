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

const PLATFORM_COLORS = {
  instagram: {
    border: "rgb(168, 85, 247)",
    background: "rgba(168, 85, 247, 0.1)",
    label: "Instagram",
  },
  tiktok: {
    border: "rgb(55, 65, 81)",
    background: "rgba(55, 65, 81, 0.1)",
    label: "TikTok",
  },
  facebook: {
    border: "rgb(37, 99, 235)",
    background: "rgba(37, 99, 235, 0.1)",
    label: "Facebook",
  },
};

type TimeRange = "30" | "90" | "all";

const RANGE_LABELS: Record<TimeRange, string> = {
  "30": "Last 30 days",
  "90": "Last 90 days",
  all: "All time",
};

interface GrowthChartProps {
  platform: keyof typeof PLATFORM_COLORS;
}

export default function GrowthChart({ platform }: GrowthChartProps) {
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [range, setRange] = useState<TimeRange>("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    fetch(`/api/history?platform=${platform}&range=${range}`, {
      signal: abortRef.current.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: HistoryPoint[]) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(String(err));
          setLoading(false);
        }
      });
  }, [platform, range]);

  const config = PLATFORM_COLORS[platform];

  const chartData = {
    labels: data.map((d) =>
      new Date(d.date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      })
    ),
    datasets: [
      {
        label: config.label,
        data: data.map((d) => d.followers),
        borderColor: config.border,
        backgroundColor: config.background,
        borderWidth: 2,
        pointRadius: data.length > 60 ? 0 : 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number } }) =>
            ` ${ctx.parsed.y.toLocaleString()} followers`,
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
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: config.border }}
          />
          <h3 className="font-semibold text-slate-800 leading-tight">
            {config.label} Growth
          </h3>
        </div>
        {/* Range Selector */}
        <div className="flex w-full sm:w-auto overflow-x-auto bg-slate-100 rounded-lg p-0.5 gap-0.5 whitespace-nowrap">
          {(Object.entries(RANGE_LABELS) as [TimeRange, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`shrink-0 px-2.5 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors ${
                  range === key
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="sm:hidden">{key === "all" ? "All" : `${key}d`}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Chart Body */}
      <div className="h-52">
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
        {!loading && !error && data.length === 0 && (
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
        {!loading && !error && data.length > 0 && (
          <Line data={chartData} options={options as Parameters<typeof Line>[0]["options"]} />
        )}
      </div>
    </div>
  );
}
