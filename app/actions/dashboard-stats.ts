"use server";

import { pool } from "@/lib/db";
import { requireAuthenticatedSession } from "@/lib/action-auth";
import { log } from "@/lib/logger";

export interface DashboardCounts {
  projectCount: number;
  inventoryCount: number;
  eventCount: number;
  expenseTotal: number;
  teamCount: number;
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  try {
    await requireAuthenticatedSession();
    const [projectsRes, inventoryRes, eventsRes, expensesRes, teamRes] =
      await Promise.all([
        pool.query("SELECT COUNT(*) as count FROM projects"),
        pool.query("SELECT COUNT(*) as count FROM inventory_items"),
        pool.query(
          "SELECT COUNT(*) as count FROM events WHERE date >= CURRENT_DATE"
        ),
        pool.query(
          "SELECT COALESCE(SUM(amount), 0)::float as total FROM expenses WHERE date >= date_trunc('month', CURRENT_DATE)"
        ),
        pool.query("SELECT COUNT(*) as count FROM users WHERE role != 'ADMIN'"),
      ]);
      

    return {
      projectCount: parseInt(projectsRes.rows[0].count),
      inventoryCount: parseInt(inventoryRes.rows[0].count),
      eventCount: parseInt(eventsRes.rows[0].count),
      expenseTotal: expensesRes.rows[0].total,
      teamCount: parseInt(teamRes.rows[0].count),
    };
  } catch (error) {
    log.error("Error fetching dashboard counts", error);
    return {
      projectCount: 0,
      inventoryCount: 0,
      eventCount: 0,
      expenseTotal: 0,
      teamCount: 0,
    };
  }
}
