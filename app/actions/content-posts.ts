"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";

export interface ContentPostRow {
  id: number;
  platform: string;
  caption: string;
  date: string;
  time: string;
  status: string;
  notes: string;
  created_at: string;
}

async function assertCanEdit() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "ADMIN" &&
      session.role !== "HEAD" &&
      session.department !== "PR & Social")
  ) {
    throw new Error("Not authorized");
  }
  return session;
}

export async function getContentPosts() {
  try {
    const res = await pool.query(
      "SELECT id, platform, caption, date::text, time, status, notes, created_at FROM content_posts ORDER BY date DESC, time ASC"
    );
    return { success: true, posts: res.rows as ContentPostRow[] };
  } catch (error) {
    console.error("Error fetching content posts:", error);
    return { error: "Failed to fetch content posts" };
  }
}

export async function createContentPost(data: {
  platform: string;
  caption: string;
  date: string;
  time: string;
  status: string;
  notes: string;
}) {
  try {
    await assertCanEdit();
    const res = await pool.query(
      `INSERT INTO content_posts (platform, caption, date, time, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        data.platform,
        data.caption,
        data.date,
        data.time,
        data.status,
        data.notes,
      ]
    );
    return { success: true, id: res.rows[0].id };
  } catch (error) {
    console.error("Error creating content post:", error);
    return { error: "Failed to create content post" };
  }
}

export async function updateContentPost(
  id: number,
  data: {
    platform: string;
    caption: string;
    date: string;
    time: string;
    status: string;
    notes: string;
  }
) {
  try {
    await assertCanEdit();
    await pool.query(
      `UPDATE content_posts SET platform=$1, caption=$2, date=$3, time=$4, status=$5, notes=$6 WHERE id=$7`,
      [
        data.platform,
        data.caption,
        data.date,
        data.time,
        data.status,
        data.notes,
        id,
      ]
    );
    return { success: true };
  } catch (error) {
    console.error("Error updating content post:", error);
    return { error: "Failed to update content post" };
  }
}

export async function deleteContentPost(id: number) {
  try {
    await assertCanEdit();
    await pool.query("DELETE FROM content_posts WHERE id = $1", [id]);
    return { success: true };
  } catch (error) {
    console.error("Error deleting content post:", error);
    return { error: "Failed to delete content post" };
  }
}
