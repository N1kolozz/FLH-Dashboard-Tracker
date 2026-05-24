import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  type BrowserPushSubscription,
  deletePushSubscription,
  syncPushSubscription,
} from "@/lib/push";
import { getSessionUserId } from "@/lib/permissions";

type RouteBody = {
  endpoint?: string;
  subscription?: BrowserPushSubscription;
};

export const dynamic = "force-dynamic";

async function requirePushUserId() {
  const session = await getSession();
  if (!session) {
    return {
      response: NextResponse.json({ error: "Not authorized" }, { status: 401 }),
    };
  }

  const userId = getSessionUserId(session);
  if (!userId) {
    return {
      response: NextResponse.json({ error: "Invalid session" }, { status: 400 }),
    };
  }

  return { userId };
}

export async function POST(request: Request) {
  const auth = await requirePushUserId();
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as RouteBody;
  if (!body.subscription) {
    return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
  }

  const preferences = await syncPushSubscription(
    auth.userId,
    body.subscription,
    request.headers.get("user-agent") ?? "unknown"
  );

  return NextResponse.json({ success: true, preferences });
}

export async function DELETE(request: Request) {
  const auth = await requirePushUserId();
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as RouteBody;
  if (!body.endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await deletePushSubscription(auth.userId, body.endpoint);

  return NextResponse.json({ success: true });
}
