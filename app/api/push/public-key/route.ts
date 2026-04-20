import { NextResponse } from "next/server";
import { getPublicPushKey, isPushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: getPublicPushKey(),
  });
}
