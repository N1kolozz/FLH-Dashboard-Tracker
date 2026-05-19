"use server";

import { pool } from "@/lib/db";
import { requireAuthenticatedSession, requireDepartmentManagerSession } from "@/lib/action-auth";
import { getSessionUserId } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export interface CheckoutRow {
  id: number;
  person: string;
  checkout_date: string;
  return_date: string | null;
}

export interface InventoryItemRow {
  id: number;
  name: string;
  category: string;
  quantity: number;
  status: string;
  location: string;
  condition: string;
  notes: string;
  checkouts: CheckoutRow[];
  created_at: string;
}

export async function getInventoryItems() {
  try {
    await requireAuthenticatedSession();
    const itemsRes = await pool.query(
      "SELECT id, name, category, quantity, status, location, condition, notes, created_at FROM inventory_items ORDER BY created_at DESC"
    );
    const items = itemsRes.rows;

    // Fetch all checkouts in one query for efficiency
    const checkoutsRes = await pool.query(
      "SELECT id, item_id, person, checkout_date::text, return_date::text FROM inventory_checkouts ORDER BY created_at ASC"
    );
    const checkoutsByItemId: Record<number, CheckoutRow[]> = {};
    for (const row of checkoutsRes.rows) {
      if (!checkoutsByItemId[row.item_id]) checkoutsByItemId[row.item_id] = [];
      checkoutsByItemId[row.item_id].push({
        id: row.id,
        person: row.person,
        checkout_date: row.checkout_date,
        return_date: row.return_date,
      });
    }

    const result: InventoryItemRow[] = items.map((item) => ({
      ...item,
      checkouts: checkoutsByItemId[item.id] || [],
    }));

    return { success: true, items: result };
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return { error: "Failed to fetch inventory" };
  }
}

export async function createInventoryItem(data: {
  name: string;
  category: string;
  quantity: number;
  status: string;
  location: string;
  condition: string;
  notes: string;
}) {
  try {
    const session = await requireDepartmentManagerSession("Projects");
    const actorUserId = getSessionUserId(session);
    const res = await pool.query(
      `INSERT INTO inventory_items (name, category, quantity, status, location, condition, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
      [
        data.name,
        data.category,
        data.quantity,
        data.status,
        data.location,
        data.condition,
        data.notes,
      ]
    );
    const createdAt = res.rows[0].created_at;

    await logActivity("create_inventory", "/logistics/inventory", { itemId: res.rows[0].id, name: data.name }, actorUserId || undefined);

    return {
      success: true,
      id: res.rows[0].id as number,
      createdAt:
        createdAt instanceof Date
          ? createdAt.toISOString()
          : String(createdAt),
    };
  } catch (error) {
    console.error("Error creating inventory item:", error);
    return { error: "Failed to create inventory item" };
  }
}

export async function updateInventoryItem(
  id: number,
  data: {
    name: string;
    category: string;
    quantity: number;
    status: string;
    location: string;
    condition: string;
    notes: string;
  }
) {
  try {
    const session = await requireDepartmentManagerSession("Projects");
    const actorUserId = getSessionUserId(session);
    await pool.query(
      `UPDATE inventory_items SET name=$1, category=$2, quantity=$3, status=$4, location=$5, condition=$6, notes=$7 WHERE id=$8`,
      [
        data.name,
        data.category,
        data.quantity,
        data.status,
        data.location,
        data.condition,
        data.notes,
        id,
      ]
    );
    await logActivity("update_inventory", "/logistics/inventory", { itemId: id, name: data.name }, actorUserId || undefined);
    return { success: true };
  } catch (error) {
    console.error("Error updating inventory item:", error);
    return { error: "Failed to update inventory item" };
  }
}

export async function deleteInventoryItem(id: number) {
  try {
    const session = await requireDepartmentManagerSession("Projects");
    const actorUserId = getSessionUserId(session);
    await pool.query("DELETE FROM inventory_items WHERE id = $1", [id]);
    await logActivity("delete_inventory", "/logistics/inventory", { itemId: id }, actorUserId || undefined);
    return { success: true };
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    return { error: "Failed to delete inventory item" };
  }
}

export async function checkoutItem(itemId: number, person: string) {
  try {
    const session = await requireDepartmentManagerSession("Projects");
    const actorUserId = getSessionUserId(session);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const checkoutRes = await client.query(
        `INSERT INTO inventory_checkouts (item_id, person, checkout_date)
         VALUES ($1, $2, CURRENT_DATE)
         RETURNING id, checkout_date::text`,
        [itemId, person]
      );
      await client.query(
        `UPDATE inventory_items SET status = 'in_use' WHERE id = $1`,
        [itemId]
      );
      await client.query("COMMIT");

      await logActivity("checkout_inventory", "/logistics/inventory", { itemId, person }, actorUserId || undefined);

      return {
        success: true,
        checkout: {
          id: checkoutRes.rows[0].id as number,
          person,
          checkout_date: String(checkoutRes.rows[0].checkout_date),
          return_date: null,
        },
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error checking out item:", error);
    return { error: "Failed to check out item" };
  }
}

export async function checkinItem(itemId: number) {
  try {
    const session = await requireDepartmentManagerSession("Projects");
    const actorUserId = getSessionUserId(session);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const checkinRes = await client.query(
        `UPDATE inventory_checkouts SET return_date = CURRENT_DATE
         WHERE id = (
           SELECT id FROM inventory_checkouts
           WHERE item_id = $1 AND return_date IS NULL
           ORDER BY created_at DESC LIMIT 1
         )
         RETURNING id, return_date::text`,
        [itemId]
      );
      await client.query(
        `UPDATE inventory_items SET status = 'available' WHERE id = $1`,
        [itemId]
      );
      await client.query("COMMIT");

      await logActivity("checkin_inventory", "/logistics/inventory", { itemId }, actorUserId || undefined);

      return {
        success: true,
        checkoutId: checkinRes.rows[0]?.id as number | undefined,
        returnDate: checkinRes.rows[0]?.return_date
          ? String(checkinRes.rows[0].return_date)
          : null,
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error checking in item:", error);
    return { error: "Failed to check in item" };
  }
}
