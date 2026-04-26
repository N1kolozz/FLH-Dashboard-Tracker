import AttendancePageClient from "./AttendancePageClient";
import { getAttendanceSessionDetails, getAttendanceSessions, getAttendanceStats } from "@/app/actions/attendance";
import { getEvents } from "@/app/actions/events";
import { getSession } from "@/lib/auth";
import { canManageAttendanceAndWorkload } from "@/lib/permissions";

export default async function AttendancePage() {
  const session = await getSession();

  if (!canManageAttendanceAndWorkload(session)) {
    return (
      <AttendancePageClient
        initialSession={session}
        initialSessions={[]}
        initialStats={null}
        initialEvents={[]}
        initialDetails={null}
      />
    );
  }

  const [sessionsResult, statsResult, eventsResult] = await Promise.all([
    getAttendanceSessions(),
    getAttendanceStats(),
    getEvents(),
  ]);

  const initialSessions =
    "success" in sessionsResult && sessionsResult.sessions
      ? sessionsResult.sessions
      : [];
  const initialDetails =
    initialSessions[0] && typeof initialSessions[0].id === "number"
      ? await getAttendanceSessionDetails(initialSessions[0].id)
      : null;

  return (
    <AttendancePageClient
      initialSession={session}
      initialSessions={initialSessions}
      initialStats={
        "success" in statsResult && statsResult.stats ? statsResult.stats : null
      }
      initialEvents={
        "success" in eventsResult && eventsResult.events ? eventsResult.events : []
      }
      initialDetails={
        initialDetails && "success" in initialDetails && initialDetails.session && initialDetails.records
          ? { session: initialDetails.session, records: initialDetails.records }
          : null
      }
    />
  );
}
