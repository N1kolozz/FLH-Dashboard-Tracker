"use server";

import { pool } from "@/lib/db";
import { encrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";

export async function checkEmail(email: string) {
  try {
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
    console.error("Error checking email:", error);
    return { error: "Database error" };
  }
}

export async function login(email: string, password: string) {
  try {
    const res = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
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
    const sessionCookieStr = await encrypt(sessionData);

    cookies().set("session", sessionCookieStr, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return { error: "Login failed" };
  }
}

export async function createPassword(email: string, password: string) {
  try {
    const res = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
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
    const sessionCookieStr = await encrypt(sessionData);

    cookies().set("session", sessionCookieStr, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return { success: true };
  } catch (error) {
    console.error("Create password error:", error);
    return { error: "Failed to create password" };
  }
}

export async function logout() {
  cookies().delete("session");
  redirect("/login");
}

