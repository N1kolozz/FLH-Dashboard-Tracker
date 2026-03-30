"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function addMember(formData: {
  fullName: string;
  email: string;
  role: string;
  department: string;
  systemRole: string;
}) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "HEAD")) {
      return { error: "Not authorized to add members" };
    }

    // Only ADMIN can create HEAD or ADMIN users
    const targetRole = formData.systemRole || "MEMBER";
    if ((targetRole === "ADMIN" || targetRole === "HEAD") && session.role !== "ADMIN") {
      return { error: "Only ADMIN can assign HEAD or ADMIN roles" };
    }

    const res = await pool.query("SELECT id FROM users WHERE email = $1", [
      formData.email,
    ]);

    if (res.rows.length > 0) {
      return { error: "Email already exists" };
    }

    await pool.query(
      "INSERT INTO users (email, full_name, role, department, position) VALUES ($1, $2, $3, $4, $5)",
      [formData.email, formData.fullName, targetRole, formData.department, formData.role || ""]
    );

    return { success: true };
  } catch (error) {
    console.error("Error adding member:", error);
    return { error: "Failed to add member" };
  }
}

export async function getMembers() {
  try {
    const res = await pool.query(
      "SELECT id, full_name as name, role, department, email, position, created_at FROM users ORDER BY created_at DESC"
    );
    return { success: true, members: res.rows };
  } catch (error) {
    console.error("Error fetching members:", error);
    return { error: "Failed to fetch members" };
  }
}

export async function deleteMember(id: number) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "HEAD")) {
      return { error: "Not authorized to delete members" };
    }

    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    return { success: true };
  } catch (error) {
    console.error("Error deleting member:", error);
    return { error: "Failed to delete member" };
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
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "HEAD")) {
      return { error: "Not authorized to edit members" };
    }

    // Only ADMIN can CHANGE someone's role to HEAD or ADMIN
    const targetRole = data.systemRole || "MEMBER";
    if ((targetRole === "ADMIN" || targetRole === "HEAD") && session.role !== "ADMIN") {
      // Check if the role is actually changing — if it's the same, allow it
      const current = await pool.query("SELECT role FROM users WHERE id = $1", [id]);
      if (current.rows.length === 0) return { error: "Member not found" };
      if (current.rows[0].role !== targetRole) {
        return { error: "Only ADMIN can assign HEAD or ADMIN roles" };
      }
    }

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
    console.error("Error updating member:", error);
    return { error: "Failed to update member" };
  }
}
