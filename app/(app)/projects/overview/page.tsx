import ProjectsOverviewPageClient from "./ProjectsOverviewPageClient";
import { getImpactRecords } from "@/app/actions/impact";
import { getMembers } from "@/app/actions/members";
import { getProjects } from "@/app/actions/projects";
import { getProjectReviewStatuses } from "@/app/actions/reviews";

export default async function ProjectsOverviewPage() {
  const [projectsResult, outcomesResult, membersResult, reviewStatuses] = await Promise.all([
    getProjects(),
    getImpactRecords(),
    getMembers(),
    getProjectReviewStatuses(),
  ]);

  const projects =
    "success" in projectsResult && projectsResult.projects
      ? projectsResult.projects
      : [];
  const rejectionFeedbacks: Record<
    number,
    { feedback: string | null; reviewerName: string | null; rejectedAt: string | null }
  > = {};

  for (const project of projects) {
    if (project.status === "rejected") {
      const reviewStatus = reviewStatuses[project.id];
      if (reviewStatus) {
        rejectionFeedbacks[project.id] = {
          feedback: reviewStatus.feedback,
          reviewerName: null,
          rejectedAt: null,
        };
      }
    }
  }

  return (
    <ProjectsOverviewPageClient
      initialProjects={projects}
      initialOutcomes={
        "success" in outcomesResult && outcomesResult.records
          ? outcomesResult.records
          : []
      }
      initialMembers={
        "success" in membersResult && membersResult.members
          ? (membersResult.members as Array<{ id: number; name: string }>)
          : []
      }
      initialRejectionFeedbacks={rejectionFeedbacks}
    />
  );
}
