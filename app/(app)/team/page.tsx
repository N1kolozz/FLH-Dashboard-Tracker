import TeamPageClient from "./TeamPageClient";
import { getMembers } from "@/app/actions/members";
import { getSession } from "@/lib/auth";

export default async function TeamPage() {
  const [session, membersResult] = await Promise.all([getSession(), getMembers()]);

  return (
    <TeamPageClient
      initialSession={session}
      initialMembers={
        "success" in membersResult && membersResult.members
          ? (membersResult.members as {
              id: number;
              name: string;
              role: string;
              department: string;
              email: string;
              position: string;
              created_at: string;
            }[])
          : []
      }
    />
  );
}
