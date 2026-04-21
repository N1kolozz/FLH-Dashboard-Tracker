import ProjectsBoardPageClient from "./ProjectsBoardPageClient";
import { getMembers } from "@/app/actions/members";
import { getProjects } from "@/app/actions/projects";
import { getProjectReviewStatuses } from "@/app/actions/reviews";
import { getSession } from "@/lib/auth";

export default async function ProjectsPage() {
  const [session, projectsResult, membersResult, reviewStatuses] = await Promise.all([
    getSession(),
    getProjects(),
    getMembers(),
    getProjectReviewStatuses(),
  ]);

  return (
    <ProjectsBoardPageClient
      initialSession={session}
      initialProjects={
        "success" in projectsResult && projectsResult.projects
          ? projectsResult.projects
          : []
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
