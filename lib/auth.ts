import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import {
  decrypt,
  encrypt,
  getSessionMaxAgeSeconds,
  type Session,
} from "@/lib/session-token";

export { decrypt, encrypt, type Session };

export async function getSession(): Promise<Session | null> {
  const session = (await cookies()).get("session")?.value;
  if (!session) return null;
  return await decrypt(session);
}

export async function updateSession(request: NextRequest): Promise<Response | undefined> {
  const session = request.cookies.get("session")?.value;
  if (!session) return;

  // Refresh session so it doesn't expire
  const parsed = await decrypt(session);
  if (!parsed) return;
  const res = new Response("OK");
  // In production we send Secure so the cookie is never transmitted over
  // plain HTTP. In dev we omit it because localhost is plain HTTP.
  const secureAttr = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `session=${await encrypt(parsed)}; Path=/; HttpOnly; SameSite=Lax${secureAttr}; Max-Age=${getSessionMaxAgeSeconds()}`
  );
  return res;
}
