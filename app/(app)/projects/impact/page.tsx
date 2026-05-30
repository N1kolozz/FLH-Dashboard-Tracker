import ProjectsImpactPageClient from "./ProjectsImpactPageClient";
import { getImpactRecords, getImpactStats } from "@/app/actions/impact";
import { getProjects } from "@/app/actions/projects";
import { getSession } from "@/lib/auth";

export default async function ProjectsImpactPage() {
  const [session, projectsResult, recordsResult, statsResult] = await Promise.all([
    getSession(),
    getProjects(),
    getImpactRecords(),
    getImpactStats(),
  ]);

  const hasRecords = "success" in recordsResult && recordsResult.records;

  return (
    <ProjectsImpactPageClient
      initialSession={session}
      initialProjects={
        "success" in projectsResult && projectsResult.projects
          ? projectsResult.projects
          : []
      }
      initialRecords={hasRecords ? recordsResult.records : []}
      initialTotal={hasRecords ? recordsResult.total ?? 0 : 0}
      initialPageSize={hasRecords ? recordsResult.pageSize ?? 15 : 15}
      initialStats={
        "success" in statsResult && statsResult.stats
          ? statsResult.stats
          : { totalPeople: 0, totalActivities: 0, projectCount: 0, unlinkedCount: 0, byProject: [] }
      }
    />
  );
}
