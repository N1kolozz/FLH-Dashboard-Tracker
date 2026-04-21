import SocialPageClient from "./SocialPageClient";
import {
  getSocialHistory,
  getSocialStats,
  type HistoryPoint,
  type SocialPlatform,
} from "@/lib/queries/social";

const PLATFORMS: SocialPlatform[] = ["instagram", "tiktok", "facebook"];

export default async function SocialPage() {
  const stats = await getSocialStats();
  const initialHistoryEntries = await Promise.all(
    PLATFORMS.map(async (platform) => [
      platform,
      await getSocialHistory({ platform, range: "30" }),
    ] as const)
  );

  const initialHistoryByPlatform = Object.fromEntries(
    initialHistoryEntries
  ) as Record<SocialPlatform, HistoryPoint[]>;

  return (
    <SocialPageClient
      initialStats={stats}
      initialHistoryByPlatform={initialHistoryByPlatform}
      initialGeneratedAt={new Date().toISOString()}
    />
  );
}
