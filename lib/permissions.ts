import { Session } from "./auth";

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

/**
 * Checks if a user has sufficient privileges to manage Projects.
 * Requires Admin, Head, or 'Projects' department membership.
 */
export function canManageProjects(session: Session | null): boolean {
  if (isHeadOrAdmin(session)) return true;
  return session?.department === "Projects";
}

export function assertCanManageProjects(session: Session | null) {
  assertAuthenticated(session);
  if (!canManageProjects(session)) {
    throw new Error("Not authorized: Requires Projects department membership or HEAD/ADMIN role");
  }
  return session;
}

/**
 * Checks if a user has sufficient privileges to manage Attendance or Workload.
 * Requires Admin, Head, or 'Management' department membership.
 */
export function canManageAttendanceAndWorkload(session: Session | null): boolean {
  if (isHeadOrAdmin(session)) return true;
  return session?.department === "Management";
}

export function assertCanManageAttendance(session: Session | null) {
  assertAuthenticated(session);
  if (!canManageAttendanceAndWorkload(session)) {
    throw new Error("Not authorized: Requires Management department membership or HEAD/ADMIN role");
  }
  return session;
}
