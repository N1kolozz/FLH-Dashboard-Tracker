"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { StatsResponse } from "@/app/api/stats/route";
import { loadStore } from "@/lib/store";

/* ─── Types for localStorage modules ─── */
interface Project {
  id: string;
  name: string;
  status: string;
}
interface InventoryItem {
  id: string;
  name: string;
  status: string;
}
interface CalEvent {
  id: string;
  title: string;
  date: string;
}
interface Expense {
  id: string;
  amount: number;
  date: string;
}
interface TeamMember {
  id: string;
  name: string;
  department: string;
}

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
      className="group bg-white hover:bg-slate-50 transition-colors rounded-2xl border border-purple-100 p-5"
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}
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

/* ─── Quick-link card ─── */
function QuickLink({
  label,
  description,
  href,
  icon,
}: {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 bg-white rounded-xl border border-slate-100 px-4 py-3 hover:border-purple-200 hover:bg-purple-50/30 transition-all duration-150"
    >
      <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-purple-100 flex items-center justify-center text-slate-400 group-hover:text-purple-600 transition-colors shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700 group-hover:text-purple-700 transition-colors">
          {label}
        </p>
        <p className="text-xs text-slate-500 truncate">{description}</p>
      </div>
      <svg
        className="w-4 h-4 text-slate-300 group-hover:text-purple-400 ml-auto shrink-0 transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

export default function DashboardPage() {
  const [totalFollowers, setTotalFollowers] = useState<string>("—");
  const [followerGrowth, setFollowerGrowth] = useState<string>("—");
  const [projectCount, setProjectCount] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [teamCount, setTeamCount] = useState(0);

  // Fetch social stats from API
  const fetchSocial = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) return;
      const data: StatsResponse = await res.json();
      const values = Object.values(data);
      const fols = values
        .map((s) => s.followers)
        .filter((v): v is number => v !== null);
      const total = fols.reduce((a, b) => a + b, 0);
      setTotalFollowers(total.toLocaleString());

      const growths = values
        .map((s) => s.daily_growth)
        .filter((v): v is number => v !== null);
      const totalGrowth = growths.reduce((a, b) => a + b, 0);
      setFollowerGrowth(
        totalGrowth >= 0 ? `+${totalGrowth.toLocaleString()}` : totalGrowth.toLocaleString()
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchSocial();

    // Load localStorage stats
    const projects = loadStore<Project>("flh_projects");
    setProjectCount(projects.length);

    const inventory = loadStore<InventoryItem>("flh_inventory");
    setInventoryCount(inventory.length);

    const events = loadStore<CalEvent>("flh_events");
    // upcoming events only
    const today = new Date().toISOString().slice(0, 10);
    setEventCount(events.filter((e) => e.date >= today).length);

    const expenses = loadStore<Expense>("flh_expenses");
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthTotal = expenses
      .filter((e) => e.date.startsWith(thisMonth))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    setExpenseTotal(monthTotal);

    const team = loadStore<TeamMember>("flh_team");
    setTeamCount(team.length);
  }, [fetchSocial]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-purple-200/70 bg-gradient-to-r from-violet-100/70 via-purple-100/65 to-fuchsia-100/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            Welcome back
            <svg className="w-6 h-6 sm:w-7 sm:h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Here&apos;s an overview of Future Leaders Hub operations
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
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
              href="/projects"
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
          <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm text-center">
            <p className="text-xl font-bold text-slate-900">{followerGrowth}</p>
            <p className="text-xs text-slate-500 mt-0.5">Today&apos;s Growth</p>
          </div>
          <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm text-center">
            <p className="text-xl font-bold text-slate-900">
              {expenseTotal > 0 ? `₾${expenseTotal.toLocaleString()}` : "₾0"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Expenses This Month</p>
          </div>
          <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm text-center">
            <p className="text-xl font-bold text-slate-900">{teamCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Team Members</p>
          </div>
        </section>

        {/* Quick Links */}
        <section>
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickLink
              label="Social Analytics"
              description="View follower growth and platform stats"
              href="/social"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            />
            <QuickLink
              label="Content Calendar"
              description="Plan and schedule social media posts"
              href="/social/calendar"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />
            <QuickLink
              label="Project Board"
              description="Manage projects with drag-and-drop kanban"
              href="/projects"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              }
            />
            <QuickLink
              label="Inventory"
              description="Track and manage NGO assets and supplies"
              href="/logistics/inventory"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
            />
            <QuickLink
              label="Expense Tracker"
              description="Log expenses and track spending by category"
              href="/logistics/expenses"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <QuickLink
              label="Team Directory"
              description="View and manage team members"
              href="/team"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
