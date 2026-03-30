import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const secretKey = process.env.JWT_SECRET || "flh-super-secret-key-fallback";
const key = new TextEncoder().encode(secretKey);

export interface Session {
  userId: string;
  email: string;
  role: string;
  department: string;
  fullName: string;
}

type SessionPayload = Session & JWTPayload;

export async function encrypt(payload: Session): Promise<string> {
  return await new SignJWT(payload as SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function decrypt(input: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ["HS256"],
    });
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

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
    `session=${await encrypt(parsed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  );
  return res;
}
