import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  type BrowserPushSubscription,
  deletePushSubscription,
  syncPushSubscription,
  updatePushPreferences,
} from "@/lib/push";

type RouteBody = {
  endpoint?: string;
  subscription?: BrowserPushSubscription;
  preferences?: {
    news?: boolean;
    events?: boolean;
    projects?: boolean;
    attendance?: boolean;
  };
};

function getUserId(sessionUserId: string) {
  const userId = Number(sessionUserId);
  return Number.isInteger(userId) ? userId : null;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const userId = getUserId(session.userId);
  if (!userId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const body = (await request.json()) as RouteBody;
  if (!body.subscription) {
    return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
  }

  const preferences = await syncPushSubscription(
    userId,
    body.subscription,
    request.headers.get("user-agent") ?? "unknown"
  );

  return NextResponse.json({ success: true, preferences });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const userId = getUserId(session.userId);
  if (!userId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const body = (await request.json()) as RouteBody;
  if (!body.endpoint || !body.preferences) {
    return NextResponse.json({ error: "Missing endpoint or preferences" }, { status: 400 });
  }

  const preferences = await updatePushPreferences(userId, body.endpoint, {
    news: body.preferences.news ?? true,
    events: body.preferences.events ?? true,
    projects: body.preferences.projects ?? true,
    attendance: body.preferences.attendance ?? true,
  });

  return NextResponse.json({ success: true, preferences });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const userId = getUserId(session.userId);
  if (!userId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const body = (await request.json()) as RouteBody;
  if (!body.endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await deletePushSubscription(userId, body.endpoint);

  return NextResponse.json({ success: true });
}
