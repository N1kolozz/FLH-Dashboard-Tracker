import ProjectsImpactPageClient from "./ProjectsImpactPageClient";
import { getImpactRecords } from "@/app/actions/impact";
import { getProjects } from "@/app/actions/projects";
import { getSession } from "@/lib/auth";

export default async function ProjectsImpactPage() {
  const [session, projectsResult, recordsResult] = await Promise.all([
    getSession(),
    getProjects(),
    getImpactRecords(),
  ]);

  return (
    <ProjectsImpactPageClient
      initialSession={session}
      initialProjects={
        "success" in projectsResult && projectsResult.projects
          ? projectsResult.projects
          : []
      }
      initialRecords={
        "success" in recordsResult && recordsResult.records
          ? recordsResult.records
          : []
      }
    />
  );
}
