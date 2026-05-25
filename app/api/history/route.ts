import { NextRequest, NextResponse } from "next/server";
import {
  getSocialHistory,
  type SocialHistoryRange,
  type SocialPlatform,
} from "@/lib/queries/social";
import { log } from "@/lib/logger";

export { type HistoryPoint } from "@/lib/queries/social";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const platform = searchParams.get("platform");
  const rangeParam = searchParams.get("range") ?? "30";
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!platform) {
    return NextResponse.json(
      { error: "Missing required query param: platform" },
      { status: 400 }
    );
  }

  const validPlatforms = ["instagram", "tiktok", "facebook"] as const;
  if (!validPlatforms.includes(platform as SocialPlatform)) {
    return NextResponse.json(
      { error: `Invalid platform. Must be one of: ${validPlatforms.join(", ")}` },
      { status: 400 }
    );
  }

  const validRanges = ["30", "90", "all"] as const;
  if (!validRanges.includes(rangeParam as SocialHistoryRange)) {
    return NextResponse.json(
      { error: `Invalid range. Must be one of: ${validRanges.join(", ")}` },
      { status: 400 }
    );
  }

  const typedPlatform = platform as SocialPlatform;
  const typedRange = rangeParam as SocialHistoryRange;

  try {
    return NextResponse.json(
      await getSocialHistory({
        platform: typedPlatform,
        range: typedRange,
        start: start ?? undefined,
        end: end ?? undefined,
      })
    );
  } catch (err) {
    log.error("History API error", err);
    return NextResponse.json(
      { error: "Failed to fetch history", details: String(err) },
      { status: 500 }
    );
  }
}
