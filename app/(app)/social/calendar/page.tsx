import SocialCalendarPageClient from "./SocialCalendarPageClient";
import { getContentPosts } from "@/app/actions/content-posts";
import { getMembers } from "@/app/actions/members";
import { getPostReviewStatuses } from "@/app/actions/reviews";
import { getSession } from "@/lib/auth";

export default async function SocialCalendarPage() {
  const [session, postsResult, membersResult, reviewStatuses] = await Promise.all([
    getSession(),
    getContentPosts(),
    getMembers(),
    getPostReviewStatuses(),
  ]);

  return (
    <SocialCalendarPageClient
      initialSession={session}
      initialPosts={
        "success" in postsResult && postsResult.posts ? postsResult.posts : []
      }
      initialMembers={
        "success" in membersResult && membersResult.members
          ? (membersResult.members as { id: number; name: string }[])
          : []
      }
      initialReviewStatuses={reviewStatuses}
    />
  );
}
