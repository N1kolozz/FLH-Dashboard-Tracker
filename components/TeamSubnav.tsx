"use client";

import Link from "next/link";

type TeamSubnavProps = {
  active: "directory" | "workload";
  className?: string;
};

const ITEMS = [
  { key: "directory", label: "Directory", href: "/team" },
  { key: "workload", label: "Workload", href: "/team/workload" },
] as const;

export default function TeamSubnav({ active, className = "" }: TeamSubnavProps) {
  return (
    <div
      className={`inline-flex h-12 w-full items-center gap-1 rounded-xl border border-purple-200 bg-white p-1.5 shadow-sm lg:w-auto ${className}`}
    >
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        const classes = `flex h-full flex-1 items-center justify-center rounded-xl px-5 text-base font-semibold transition-colors lg:min-w-32 lg:flex-none ${
          isActive
            ? "bg-purple-100 text-purple-700"
            : "text-slate-500 hover:bg-purple-50 hover:text-purple-700"
        }`;

        if (isActive) {
          return (
            <span key={item.key} className={classes}>
              {item.label}
            </span>
          );
        }

        return (
          <Link key={item.key} href={item.href} className={classes}>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
