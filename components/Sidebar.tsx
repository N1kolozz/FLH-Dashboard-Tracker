"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import FlhIconMark from "@/components/FlhIconMark";
import PushNotificationManager from "@/components/PushNotificationManager";
import VoiceAssistant from "@/components/VoiceAssistant";

import { NAV_SECTIONS } from "@/config/navigation";

export default function Sidebar({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [activeIndicator, setActiveIndicator] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    visible: false,
  });

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
  const canManageAttendance = Boolean(
    session &&
      (session.role === "ADMIN" ||
        session.role === "HEAD" ||
        session.department === "Management")
  );
  const canViewWorkload = Boolean(
    session && (session.role === "ADMIN" || session.role === "HEAD" || session.department === "Management")
  );
  const isHead = Boolean(session && (session.role === "ADMIN" || session.role === "HEAD"));
  const isAdmin = Boolean(session && session.role === "ADMIN");
  const visibleSections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        links: section.links.filter(
          (link) =>
            (!link.requiresAttendanceManager || canManageAttendance) &&
            (!link.requiresWorkloadAccess || canViewWorkload) &&
            (!link.requiresHeadRole || isHead) &&
            (!link.requiresAdminRole || isAdmin)
        ),
      })).filter((section) => section.links.length > 0),
    [canManageAttendance, canViewWorkload, isAdmin, isHead]
  );
  const activeHref =
    visibleSections.flatMap((section) => section.links).find((link) => isActive(link.href))
      ?.href ?? "";

  const updateActiveIndicator = useCallback(() => {
    const nav = navRef.current;
    const activeLink = activeHref ? linkRefs.current[activeHref] : null;

    if (!nav || !activeLink) {
      setActiveIndicator((current) => ({ ...current, visible: false }));
      return;
    }

    setActiveIndicator({
      top: activeLink.offsetTop,
      left: activeLink.offsetLeft,
      width: activeLink.offsetWidth,
      height: activeLink.offsetHeight,
      visible: true,
    });
  }, [activeHref]);

  useLayoutEffect(() => {
    updateActiveIndicator();
  }, [collapsed, mobileOpen, pathname, updateActiveIndicator, visibleSections]);

  useEffect(() => {
    updateActiveIndicator();

    const nav = navRef.current;
    const activeLink = activeHref ? linkRefs.current[activeHref] : null;
    if (!nav) return;

    const resizeObserver = new ResizeObserver(updateActiveIndicator);
    resizeObserver.observe(nav);
    if (activeLink) {
      resizeObserver.observe(activeLink);
    }

    window.addEventListener("resize", updateActiveIndicator);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateActiveIndicator);
    };
  }, [activeHref, updateActiveIndicator]);

  const handleLogout = async () => {
    await logout();
  };

  const navContent = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-purple-100/60">
        <FlhIconMark
          width={32}
          height={34}
          title="FLH"
          className="h-8 w-8 shrink-0"
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800 leading-none truncate">FLHUB</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Dashboard</p>
          </div>
        )}
        <span className="hidden md:contents">
          <VoiceAssistant collapsed={collapsed} />
        </span>
      </div>

      {/* Nav Links */}
      <nav ref={navRef} className="sidebar-scroll relative flex-1 overflow-y-auto px-2 py-3 space-y-4 min-h-0">
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute rounded-xl bg-purple-100/80 shadow-sm ring-1 ring-purple-200/70 transition-[opacity,transform,width,height] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            activeIndicator.visible ? "opacity-100" : "opacity-0"
          }`}
          style={{
            height: activeIndicator.height,
            left: activeIndicator.left,
            top: 0,
            transform: `translate3d(0, ${activeIndicator.top}px, 0)`,
            width: activeIndicator.width,
          }}
        />
        {visibleSections.map((section, idx) => {
          return (
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
                      ref={(node) => {
                        linkRefs.current[link.href] = node;
                      }}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? link.label : undefined}
                      className={`relative z-10 flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-200 group ${
                        active
                          ? "text-purple-700"
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
          );
        })}
      </nav>

      {/* Profile & Collapse */}
      <div className="mt-auto shrink-0 border-t border-purple-100/60 p-3 pb-safe-bottom">
        <PushNotificationManager
          variant="sidebar"
          collapsed={collapsed}
          canSendTest={session?.role?.toUpperCase() === "ADMIN"}
        />

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
      <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 overflow-hidden border-b border-white/50 bg-white/45 p-3 shadow-[0_14px_36px_-24px_rgba(30,41,59,0.75)] backdrop-blur-[22px] backdrop-saturate-150 supports-[backdrop-filter]:bg-white/35">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/70 via-white/25 to-white/10"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"
        />
        <button
          onClick={() => setMobileOpen(true)}
          className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white/45 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_22px_-16px_rgba(88,28,135,0.8)] backdrop-blur-xl transition-colors hover:bg-white/70 hover:text-slate-800 active:bg-white/80"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="relative z-10 flex flex-1 items-center gap-2">
          <FlhIconMark
            width={28}
            height={30}
            title="FLH"
            className="h-7 w-7 shrink-0"
          />
          <h2 className="text-sm font-bold text-slate-800 leading-none">FLHUB</h2>
        </div>
        <div className="relative z-10">
          <VoiceAssistant />
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
