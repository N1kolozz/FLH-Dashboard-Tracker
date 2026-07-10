import { cookies } from "next/headers";
import { decrypt, encrypt, type Session } from "@/lib/session-token";

export { encrypt, type Session };

export async function getSession(): Promise<Session | null> {
  const session = (await cookies()).get("session")?.value;
  if (!session) return null;
  return await decrypt(session);
}
