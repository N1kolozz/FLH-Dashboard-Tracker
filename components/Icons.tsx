import React from "react";
import {
  LayoutDashboard,
  Megaphone,
  Calendar,
  BarChart3,
  ClipboardList,
  Layout,
  TrendingUp,
  Package,
  CircleDollarSign,
  Star,
  CalendarCheck,
  Users,
  FileText,
  ShieldCheck,
  Monitor,
  Smartphone,
  Briefcase,
  Mail,
  Phone
} from "lucide-react";

/**
 * Icons Registry
 * We use a hybrid approach:
 * 1. Lucide React for standard UI icons (consistent, scalable, tree-shakeable)
 * 2. Custom SVGs for branding and unique animations (wave, ai, social brands)
 * 
 * Note: These are exported as JSX elements to maintain compatibility with 
 * the existing codebase.
 */

const DEFAULT_SIZE = 20;
const DEFAULT_STROKE = 1.7;

export const Icons = {
  // --- Standard UI Icons (Lucide) ---
  dashboard: <LayoutDashboard size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  social: <Megaphone size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  calendar: <Calendar size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  chart: <BarChart3 size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  projects: <ClipboardList size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  overview: <Layout size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  impact: <TrendingUp size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  inventory: <Package size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  expenses: <CircleDollarSign size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  events: <Star size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  attendance: <CalendarCheck size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  team: <Users size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  workload: <Briefcase size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  summary: <FileText size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  mail: <Mail size={14} strokeWidth={DEFAULT_STROKE} />,
  phone: <Phone size={14} strokeWidth={DEFAULT_STROKE} />,
  admin: <ShieldCheck size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  desktop: <Monitor size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,
  mobile: <Smartphone size={DEFAULT_SIZE} strokeWidth={DEFAULT_STROKE} />,

  // --- Custom Animated / Brand Icons ---
  wave: (
    <svg className="w-6 h-6 sm:w-7 sm:h-7 origin-[30%_90%] animate-[wave_2s_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7 M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8 M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8 M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  ),
  ai: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),

  // Social Brands
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
};
