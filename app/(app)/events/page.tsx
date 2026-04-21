import EventsPageClient from "./EventsPageClient";
import { getEvents } from "@/app/actions/events";
import { getMembers } from "@/app/actions/members";
import { getSession } from "@/lib/auth";

export default async function EventsPage() {
  const [session, eventsResult, membersResult] = await Promise.all([
    getSession(),
    getEvents(),
    getMembers(),
  ]);

  return (
    <EventsPageClient
      initialSession={session}
      initialEvents={
        "success" in eventsResult && eventsResult.events ? eventsResult.events : []
      }
      initialMembers={
        "success" in membersResult && membersResult.members
          ? (membersResult.members as { id: number; name: string }[])
          : []
      }
    />
  );
}
