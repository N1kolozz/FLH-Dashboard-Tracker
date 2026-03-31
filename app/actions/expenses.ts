"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";

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

async function assertCanEdit() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "ADMIN" &&
      session.role !== "HEAD" &&
      session.department !== "Logistics")
  ) {
    throw new Error("Not authorized");
  }
  return session;
}

export async function getExpenses() {
  try {
    const res = await pool.query(
      "SELECT id, description, amount::float, category, date::text, paid_by, notes, created_at FROM expenses ORDER BY date DESC, created_at DESC"
    );
    return { success: true, expenses: res.rows as ExpenseRow[] };
  } catch (error) {
    console.error("Error fetching expenses:", error);
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
    await assertCanEdit();
    const res = await pool.query(
      `INSERT INTO expenses (description, amount, category, date, paid_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        data.description,
        data.amount,
        data.category,
        data.date,
        data.paidBy,
        data.notes,
      ]
    );
    return { success: true, id: res.rows[0].id };
  } catch (error) {
    console.error("Error creating expense:", error);
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
    await assertCanEdit();
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
    return { success: true };
  } catch (error) {
    console.error("Error updating expense:", error);
    return { error: "Failed to update expense" };
  }
}

export async function deleteExpense(id: number) {
  try {
    await assertCanEdit();
    await pool.query("DELETE FROM expenses WHERE id = $1", [id]);
    return { success: true };
  } catch (error) {
    console.error("Error deleting expense:", error);
    return { error: "Failed to delete expense" };
  }
}
