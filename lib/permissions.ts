import type { Session } from "./auth";

/**
 * Ensures the session is valid and throws a standard error if not.
 */
export function assertAuthenticated(session: Session | null): asserts session is Session {
  if (!session) {
    throw new Error("Not authorized: Please log in");
  }
}

/**
 * Checks if the user has an Admin or Head role.
 */
export function isHeadOrAdmin(session: Session | null): boolean {
  if (!session) return false;
  return session.role === "ADMIN" || session.role === "HEAD";
}

export function getSessionUserId(
  session: Pick<Session, "userId"> | null | undefined
): number | null {
  if (!session) return null;
  const userId = Number(session.userId);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

/**
 * Asserts that the user is an Admin or Head.
 */
export function assertHeadOrAdmin(session: Session | null) {
  assertAuthenticated(session);
  if (!isHeadOrAdmin(session)) {
    throw new Error("Not authorized: Requires HEAD or ADMIN role");
  }
  return session;
}

export function canManageDepartment(
  session: Session | null,
  department: string
): boolean {
  if (isHeadOrAdmin(session)) return true;
  return session?.department === department;
}

export function assertCanManageDepartment(
  session: Session | null,
  department: string,
  label = department
) {
  assertAuthenticated(session);
  if (!canManageDepartment(session, department)) {
    throw new Error(
      `Not authorized: Requires ${label} department membership or HEAD/ADMIN role`
    );
  }
  return session;
}

export function assertCanAssignPrivilegedRole(
  session: Session | null,
  targetRole: string,
  currentRole?: string | null
) {
  const actor = assertHeadOrAdmin(session);
  const isPrivilegedRole = targetRole === "ADMIN" || targetRole === "HEAD";

  if (
    isPrivilegedRole &&
    actor.role !== "ADMIN" &&
    targetRole !== currentRole
  ) {
    throw new Error("Only ADMIN can assign HEAD or ADMIN roles");
  }

  return actor;
}

/**
 * Checks if a user has sufficient privileges to manage Projects.
 * Requires Admin, Head, or 'Projects' department membership.
 */
export function canManageProjects(session: Session | null): boolean {
  return canManageDepartment(session, "Projects");
}

export function assertCanManageProjects(session: Session | null) {
  return assertCanManageDepartment(session, "Projects");
}

/**
 * Checks if a user has sufficient privileges to manage Attendance or Workload.
 * Requires Admin, Head, or 'Management' department membership.
 */
export function canManageAttendanceAndWorkload(session: Session | null): boolean {
  return canManageDepartment(session, "Management");
}

export function assertCanManageAttendance(session: Session | null) {
  return assertCanManageDepartment(session, "Management", "Management");
}

export function canPublishNews(session: Session | null): boolean {
  if (!session) return false;

  const role = session.role.toUpperCase();
  const department = session.department.toLowerCase();

  return (
    role === "ADMIN" ||
    role === "HEAD" ||
    role === "MANAGEMENT" ||
    department === "management"
  );
}
