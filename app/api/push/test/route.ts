import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  broadcastTestNotification,
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

  const payload = createPushNotification({
    topic: "attendance",
    title: "FLHUB",
    body: "ტესტ შეტყობინება წარმატებით მოვიდა ამ მოწყობილობაზე.",
    url: "/dashboard",
    tag: "test-notification",
  });

  if (session.role === "ADMIN") {
    const result = await broadcastTestNotification(payload);
    return NextResponse.json({
      success: true,
      broadcast: true,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped ?? false,
      failures: result.failures,
    });
  }

  const body = (await request.json()) as RouteBody;
  if (!body.subscription) {
    return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
  }

  const result = await sendPushToSubscription(body.subscription, payload);

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }

  return NextResponse.json({ success: true, broadcast: false });
}
