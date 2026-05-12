import Sidebar from "@/components/Sidebar";
import AttendancePrompt from "@/components/AttendancePrompt";
import PwaRegistrar from "@/components/PwaRegistrar";
import ActivityTracker from "@/components/ActivityTracker";
import PageTransition from "@/components/PageTransition";
import { getSession } from "@/lib/auth";
import { getPendingAttendancePrompt } from "@/app/actions/attendance";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const promptResult = await getPendingAttendancePrompt();
  const initialPrompt =
    "success" in promptResult ? (promptResult.prompt ?? null) : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <PwaRegistrar />
      <ActivityTracker />
      <Sidebar session={session} />
      <main className="min-w-0 flex-1 md:ml-0">
        <PageTransition>{children}</PageTransition>
      </main>
      <AttendancePrompt initialPrompt={initialPrompt} />
    </div>
  );
}
