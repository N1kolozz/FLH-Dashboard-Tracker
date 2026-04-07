"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentSession } from "@/app/actions/session";
import type { Session } from "@/lib/auth";
import { logout } from "@/app/actions/auth";

/* ─── nav structure ─── */
interface NavLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  links: NavLink[];
}

const ICON = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  social: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  projects: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  overview: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6z" />
    </svg>
  ),
  impact: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  inventory: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  expenses: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  events: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  team: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  workload: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "",
    links: [{ label: "Dashboard", href: "/dashboard", icon: ICON.dashboard }],
  },
  {
    title: "PR & Social",
    links: [
      { label: "Analytics", href: "/social", icon: ICON.chart },
      { label: "Content Calendar", href: "/social/calendar", icon: ICON.calendar },
    ],
  },
  {
    title: "Projects",
    links: [
      { label: "Overview", href: "/projects/overview", icon: ICON.overview },
      { label: "Project Board", href: "/projects", icon: ICON.projects },
      { label: "Project Outcomes", href: "/projects/impact", icon: ICON.impact },
    ],
  },
  {
    title: "Logistics",
    links: [
      { label: "Inventory", href: "/logistics/inventory", icon: ICON.inventory },
      { label: "Expenses", href: "/logistics/expenses", icon: ICON.expenses },
    ],
  },
  {
    title: "Organization",
    links: [
      { label: "Events", href: "/events", icon: ICON.events },
      { label: "Team Directory", href: "/team", icon: ICON.team },
      { label: "Workload View", href: "/team/workload", icon: ICON.workload },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    getCurrentSession().then(setSession);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const isActive = (href: string) => {
    return pathname === href;
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const navContent = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-purple-100/60">
        <Image
          src="/flhlogo.svg"
          alt="FLH"
          width={32}
          height={32}
          className="w-8 h-8 rounded-xl shadow-sm object-cover shrink-0"
          priority
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 leading-none truncate">FLH Dashboard</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Future Leaders Hub</p>
          </div>
        )}
      </div>

      {/* Nav Links */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-2 py-3 space-y-4 min-h-0">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={idx}>
            {section.title && !collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {section.title}
              </p>
            )}
            {collapsed && section.title && (
              <div className="border-t border-slate-100 mx-2 mb-2" />
            )}
            <div className="space-y-0.5">
              {section.links.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? link.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group ${
                      active
                        ? "bg-purple-100/80 text-purple-700 shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    <span className={`shrink-0 ${active ? "text-purple-600" : "text-slate-400 group-hover:text-slate-600"}`}>
                      {link.icon}
                    </span>
                    {!collapsed && <span className="truncate">{link.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile & Collapse */}
      <div className="mt-auto shrink-0 border-t border-purple-100/60 p-3 pb-safe-bottom">
        {session && (
          <div className="mb-2">
            {!collapsed ? (
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100/50">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{session.fullName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{session.role} • {session.department}</p>
                </div>
                <button onClick={handleLogout} className="text-slate-400 hover:text-rose-600 transition-colors" title="Logout">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
              </div>
            ) : (
              <button onClick={handleLogout} className="w-full flex justify-center p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Logout">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            )}
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden md:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-100 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navigation */}
      <div className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-purple-100/60 p-3 flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-purple-100 shadow-sm text-slate-600 hover:text-slate-800 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <Image
            src="/flhlogo.svg"
            alt="FLH"
            width={28}
            height={28}
            className="w-7 h-7 rounded-lg shadow-sm object-cover shrink-0"
            priority
          />
          <h2 className="text-sm font-bold text-slate-800 leading-none">FLH Dashboard</h2>
        </div>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 z-50 h-[100dvh] md:h-screen
          bg-white/95 backdrop-blur-sm border-r border-purple-100/60 shadow-lg md:shadow-none
          transition-all duration-300 ease-in-out
          ${collapsed ? "md:w-[72px]" : "md:w-60"}
          ${mobileOpen ? "w-60 translate-x-0" : "-translate-x-full md:translate-x-0 w-60"}
        `}
      >
        {/* Mobile close */}
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {navContent}
      </aside>
    </>
  );
}
