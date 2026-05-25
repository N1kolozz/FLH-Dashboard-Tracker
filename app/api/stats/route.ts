import { NextResponse } from "next/server";
import { getSocialStats } from "@/lib/queries/social";
import { log } from "@/lib/logger";

export { type PlatformStats, type StatsResponse } from "@/lib/queries/social";

export async function GET() {
  try {
    return NextResponse.json(await getSocialStats());
  } catch (err) {
    log.error("Stats API error", err);
    return NextResponse.json(
      { error: "Failed to fetch stats", details: String(err) },
      { status: 500 }
    );
  }
}
