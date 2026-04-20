import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createPushNotification,
  type BrowserPushSubscription,
  sendPushToSubscription,
} from "@/lib/push";

type RouteBody = {
  subscription?: BrowserPushSubscription;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const body = (await request.json()) as RouteBody;
  if (!body.subscription) {
    return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
  }

  const result = await sendPushToSubscription(
    body.subscription,
    createPushNotification({
      topic: "attendance",
      title: "FLH Dashboard",
      body: "ტესტ შეტყობინება წარმატებით მოვიდა ამ მოწყობილობაზე.",
      url: "/dashboard",
      tag: "test-notification",
    })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
