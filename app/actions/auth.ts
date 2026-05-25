"use server";

import { pool } from "@/lib/db";
import { encrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertSameOrigin } from "@/lib/action-auth";
import { endSession } from "@/app/actions/tracking";
import { log } from "@/lib/logger";

const SESSION_COOKIE_NAME = "session";
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60,
  path: "/",
};

const USER_SESSION_SELECT = `
  SELECT id, email, password_hash, role, department, full_name
  FROM users
  WHERE email = $1
`;

function getAuthActionErrorMessage(error: unknown, fallback: string) {
  if (
    error instanceof Error &&
    (error.message.includes("JWT_SECRET") ||
      error.message.includes("session") ||
      error.message.includes("Web Crypto"))
  ) {
    return "Server session configuration error";
  }

  return fallback;
}

async function setSessionCookie(sessionData: {
  userId: number;
  email: string;
  role: string;
  department: string;
  fullName: string;
}) {
  const sessionCookieStr = await encrypt({
    ...sessionData,
    userId: String(sessionData.userId),
  });
  (await cookies()).set(SESSION_COOKIE_NAME, sessionCookieStr, SESSION_COOKIE_OPTIONS);
}

export async function checkEmail(email: string) {
  try {
    await assertSameOrigin();
    const res = await pool.query("SELECT id, password_hash FROM users WHERE email = $1", [email]);
    if (res.rows.length === 0) {
      return { exists: false };
    }
    const user = res.rows[0];
    return {
      exists: true,
      hasPassword: !!user.password_hash,
    };
  } catch (error) {
    log.error("Error checking email", error);
    return { error: "Database error" };
  }
}

export async function login(email: string, password: string) {
  try {
    await assertSameOrigin();
    const res = await pool.query(USER_SESSION_SELECT, [email]);
    if (res.rows.length === 0) return { error: "Invalid credentials" };

    const user = res.rows[0];
    if (!user.password_hash) return { error: "Password not set" };

    const isValid = await compare(password, user.password_hash);
    if (!isValid) return { error: "Invalid credentials" };

    const sessionData = {
      userId: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
      fullName: user.full_name,
    };
    await setSessionCookie(sessionData);
    
    await logActivity("login", "/login", {}, user.id);

    return { success: true };
  } catch (error) {
    log.error("Login error", error);
    return { error: getAuthActionErrorMessage(error, "Login failed") };
  }
}

export async function createPassword(email: string, password: string) {
  try {
    await assertSameOrigin();
    const res = await pool.query(USER_SESSION_SELECT, [email]);
    if (res.rows.length === 0) return { error: "User not found" };

    const user = res.rows[0];
    if (user.password_hash) return { error: "Password already set" };

    const hashed = await hash(password, 10);
    await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [hashed, email]);

    const sessionData = {
      userId: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
      fullName: user.full_name,
    };
    await setSessionCookie(sessionData);

    await logActivity("create_password_login", "/create-password", {}, user.id);

    return { success: true };
  } catch (error) {
    log.error("Create password error", error);
    return { error: getAuthActionErrorMessage(error, "Failed to create password") };
  }
}

export async function logout() {
  await logActivity("logout", "/dashboard");
  await endSession();
  (await cookies()).delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
