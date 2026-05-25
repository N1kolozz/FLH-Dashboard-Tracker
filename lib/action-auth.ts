import { headers } from "next/headers";
import { getSession, type Session } from "@/lib/auth";
import {
  assertAuthenticated,
  assertCanManageDepartment,
  assertHeadOrAdmin,
} from "@/lib/permissions";

// CSRF protection for server actions.
//
// Next.js sends every server-action POST with an "origin" header (browsers can't
// forge this from a malicious site — it's set by the browser itself). We compare
// it to the host the request was sent to. If they don't match, the request was
// triggered cross-origin and we refuse to process it.
//
// Server-component page renders also invoke these helpers (the dashboard awaits
// getDashboardCounts/News during SSR). Those are same-process calls riding on a
// GET navigation, which browsers don't tag with an Origin header — so we skip
// the check unless this request is actually a server-action invocation. Next.js
// marks those with the "next-action" header (same signal the middleware uses).
//
// Exported so unauthenticated actions (login, createPassword) can call it too —
// they don't use the require* helpers below but still need CSRF protection.
export function assertSameOrigin() {
  const h = headers();
  const isServerAction = h.get("next-action") !== null;
  if (!isServerAction) return;

  const origin = h.get("origin");
  const host = h.get("host");

  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Forbidden: Missing origin header");
    }
    return;
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Error("Forbidden: Invalid origin header");
  }

  if (originHost !== host) {
    throw new Error("Forbidden: Origin does not match host");
  }
}

export async function requireAuthenticatedSession(): Promise<Session> {
  assertSameOrigin();
  const session = await getSession();
  assertAuthenticated(session);
  return session;
}

export async function requireHeadOrAdminSession(): Promise<Session> {
  assertSameOrigin();
  return assertHeadOrAdmin(await getSession());
}

export async function requireDepartmentManagerSession(
  department: string,
  label = department
): Promise<Session> {
  assertSameOrigin();
  return assertCanManageDepartment(await getSession(), department, label);
}
