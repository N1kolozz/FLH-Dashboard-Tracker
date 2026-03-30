"use server";

import { getSession } from "@/lib/auth";

export async function getCurrentSession() {
  const session = await getSession();
  return session;
}
