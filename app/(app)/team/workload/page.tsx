import WorkloadPageClient from "./WorkloadPageClient";
import { getWorkloadData } from "@/app/actions/workload";

export default async function WorkloadPage() {
  const result = await getWorkloadData();

  return (
    <WorkloadPageClient
      initialMembers={"success" in result ? result.members : []}
      initialError={"error" in result ? result.error : ""}
    />
  );
}
