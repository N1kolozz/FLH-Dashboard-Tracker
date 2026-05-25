"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAuthenticatedSession } from "@/lib/action-auth";
import {
  assertCanAssignPrivilegedRole,
  assertHeadOrAdmin,
} from "@/lib/permissions";
import { log } from "@/lib/logger";

export async function addMember(formData: {
  fullName: string;
  email: string;
  role: string;
  department: string;
  systemRole: string;
}) {
  try {
    const session = assertHeadOrAdmin(await getSession());

    const targetRole = formData.systemRole || "MEMBER";
    assertCanAssignPrivilegedRole(session, targetRole);

    const res = await pool.query("SELECT id FROM users WHERE email = $1", [
      formData.email,
    ]);

    if (res.rows.length > 0) {
      return { error: "Email already exists" };
    }

    const insertRes = await pool.query(
      "INSERT INTO users (email, full_name, role, department, position) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at",
      [formData.email, formData.fullName, targetRole, formData.department, formData.role || ""]
    );

    const createdAt = insertRes.rows[0].created_at;

    return {
      success: true,
      id: insertRes.rows[0].id as number,
      createdAt:
        createdAt instanceof Date
          ? createdAt.toISOString()
          : String(createdAt),
    };
  } catch (error) {
    log.error("Error adding member", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to add member",
    };
  }
}

export async function getMembers() {
  try {
    await requireAuthenticatedSession();
    const res = await pool.query(
      "SELECT id, full_name as name, role, department, email, position, created_at FROM users WHERE role != 'ADMIN' ORDER BY created_at DESC"
    );
    return { success: true, members: res.rows };
  } catch (error) {
    log.error("Error fetching members", error);
    return { error: "Failed to fetch members" };
  }
}

export async function deleteMember(id: number) {
  try {
    assertHeadOrAdmin(await getSession());

    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    return { success: true };
  } catch (error) {
    log.error("Error deleting member", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete member",
    };
  }
}

export async function updateMember(
  id: number,
  data: {
    fullName: string;
    email: string;
    department: string;
    systemRole: string;
    position: string;
  }
) {
  try {
    const session = assertHeadOrAdmin(await getSession());

    const targetRole = data.systemRole || "MEMBER";
    const current = await pool.query("SELECT role FROM users WHERE id = $1", [id]);
    if (current.rows.length === 0) return { error: "Member not found" };
    assertCanAssignPrivilegedRole(session, targetRole, current.rows[0].role);

    // Check for email conflict with other users
    const emailCheck = await pool.query(
      "SELECT id FROM users WHERE email = $1 AND id != $2",
      [data.email, id]
    );
    if (emailCheck.rows.length > 0) {
      return { error: "Email already taken by another user" };
    }

    await pool.query(
      "UPDATE users SET full_name = $1, email = $2, department = $3, role = $4, position = $5 WHERE id = $6",
      [data.fullName, data.email, data.department, targetRole, data.position || "", id]
    );

    return { success: true };
  } catch (error) {
    log.error("Error updating member", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to update member",
    };
  }
}
