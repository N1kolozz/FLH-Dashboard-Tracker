"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import AttendancePrompt from "./AttendancePrompt";
import PwaRegistrar from "./PwaRegistrar";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/create-password");

  if (isAuthPage) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      <PwaRegistrar />
      <Sidebar />
      <main className="flex-1 min-w-0 md:ml-0">{children}</main>
      <AttendancePrompt />
    </div>
  );
}
