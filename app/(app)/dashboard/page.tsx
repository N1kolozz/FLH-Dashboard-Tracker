import DashboardPageClient from "./DashboardPageClient";
import { getDashboardCounts } from "@/app/actions/dashboard-stats";
import { getDashboardNews } from "@/app/actions/news";
import { getSession } from "@/lib/auth";
import { getSocialStats } from "@/lib/queries/social";

export default async function DashboardPage() {
  const [session, counts, newsResult, stats] = await Promise.all([
    getSession(),
    getDashboardCounts(),
    getDashboardNews(),
    getSocialStats(),
  ]);

  return (
    <DashboardPageClient
      initialSession={session}
      initialCounts={counts}
      initialStats={stats}
      initialNewsItems={"news" in newsResult ? newsResult.news ?? [] : []}
      initialReviewItems={
        "reviewItems" in newsResult ? newsResult.reviewItems ?? [] : []
      }
      initialNewsError={"error" in newsResult ? newsResult.error ?? "" : ""}
    />
  );
}
