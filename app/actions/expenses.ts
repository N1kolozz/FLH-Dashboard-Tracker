"use server";

import { pool } from "@/lib/db";
import { requireAuthenticatedSession, requireDepartmentManagerSession } from "@/lib/action-auth";
import { getSessionUserId } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { log } from "@/lib/logger";

export interface ExpenseRow {
  id: number;
  description: string;
  amount: number;
  category: string;
  date: string;
  paid_by: string;
  notes: string;
  created_at: string;
}

export async function getExpenses() {
  try {
    await requireAuthenticatedSession();
    const res = await pool.query(
      "SELECT id, description, amount::float, category, date::text, paid_by, notes, created_at FROM expenses ORDER BY date DESC, created_at DESC"
    );
    return { success: true, expenses: res.rows as ExpenseRow[] };
  } catch (error) {
    log.error("Error fetching expenses", error);
    return { error: "Failed to fetch expenses" };
  }
}

export async function createExpense(data: {
  description: string;
  amount: number;
  category: string;
  date: string;
  paidBy: string;
  notes: string;
}) {
  try {
    const session = await requireDepartmentManagerSession("Projects");
    const actorUserId = getSessionUserId(session);
    const res = await pool.query(
      `INSERT INTO expenses (description, amount, category, date, paid_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [
        data.description,
        data.amount,
        data.category,
        data.date,
        data.paidBy,
        data.notes,
      ]
    );
    const createdAt = res.rows[0].created_at;

    await logActivity("create_expense", "/logistics/expenses", { expenseId: res.rows[0].id, description: data.description, amount: data.amount }, actorUserId || undefined);

    return {
      success: true,
      id: res.rows[0].id as number,
      createdAt:
        createdAt instanceof Date
          ? createdAt.toISOString()
          : String(createdAt),
    };
  } catch (error) {
    log.error("Error creating expense", error);
    return { error: "Failed to create expense" };
  }
}

export async function updateExpense(
  id: number,
  data: {
    description: string;
    amount: number;
    category: string;
    date: string;
    paidBy: string;
    notes: string;
  }
) {
  try {
    const session = await requireDepartmentManagerSession("Projects");
    const actorUserId = getSessionUserId(session);
    await pool.query(
      `UPDATE expenses SET description=$1, amount=$2, category=$3, date=$4, paid_by=$5, notes=$6 WHERE id=$7`,
      [
        data.description,
        data.amount,
        data.category,
        data.date,
        data.paidBy,
        data.notes,
        id,
      ]
    );
    await logActivity("update_expense", "/logistics/expenses", { expenseId: id, description: data.description, amount: data.amount }, actorUserId || undefined);
    return { success: true };
  } catch (error) {
    log.error("Error updating expense", error);
    return { error: "Failed to update expense" };
  }
}

export async function deleteExpense(id: number) {
  try {
    const session = await requireDepartmentManagerSession("Projects");
    const actorUserId = getSessionUserId(session);
    await pool.query("DELETE FROM expenses WHERE id = $1", [id]);
    await logActivity("delete_expense", "/logistics/expenses", { expenseId: id }, actorUserId || undefined);
    return { success: true };
  } catch (error) {
    log.error("Error deleting expense", error);
    return { error: "Failed to delete expense" };
  }
}
