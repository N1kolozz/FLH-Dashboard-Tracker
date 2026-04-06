"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PROJECT_LINKS = [
  { href: "/projects/overview", label: "Overview" },
  { href: "/projects", label: "Board" },
  { href: "/projects/impact", label: "Project Outcomes" },
];

export default function ProjectsSubnav({ className = "" }: { className?: string }) {
  const pathname = usePathname();

  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {PROJECT_LINKS.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
              isActive
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                : "bg-white/60 text-slate-600 ring-1 ring-slate-200 hover:bg-white hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
