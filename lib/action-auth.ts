import { getSession, type Session } from "@/lib/auth";
import {
  assertAuthenticated,
  assertCanManageDepartment,
  assertHeadOrAdmin,
} from "@/lib/permissions";

export async function requireAuthenticatedSession(): Promise<Session> {
  const session = await getSession();
  assertAuthenticated(session);
  return session;
}

export async function requireHeadOrAdminSession(): Promise<Session> {
  return assertHeadOrAdmin(await getSession());
}

export async function requireDepartmentManagerSession(
  department: string,
  label = department
): Promise<Session> {
  return assertCanManageDepartment(await getSession(), department, label);
}
