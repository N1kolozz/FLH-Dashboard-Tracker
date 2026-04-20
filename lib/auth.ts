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
  const session = cookies().get("session")?.value;
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
  res.headers.append(
    "Set-Cookie",
    `session=${await encrypt(parsed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${getSessionMaxAgeSeconds()}`
  );
  return res;
}
