"use server";

import { pool } from "@/lib/db";
import { requireAuthenticatedSession, requireDepartmentManagerSession } from "@/lib/action-auth";
import { normalizeOwnerUserIds } from "@/lib/owner-users";
import { createPushNotification, notifySubscribers } from "@/lib/push";
import { getSessionUserId } from "@/lib/permissions";

export interface ContentPostRow {
  id: number;
  platform: string;
  caption: string;
  date: string;
  time: string;
  status: string;
  notes: string;
  owner_user_ids: number[];
  created_at: string;
}

export async function getContentPosts() {
  try {
    await requireAuthenticatedSession();
    const res = await pool.query(
      `SELECT
         cp.id,
         cp.platform,
         cp.caption,
         cp.date::text,
         cp.time,
         cp.status,
         cp.notes,
         COALESCE(
           NULLIF(cp.owner_user_ids, '{}'),
           CASE WHEN cp.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[cp.owner_user_id] END
         ) AS owner_user_ids,
         cp.created_at
       FROM content_posts cp
       ORDER BY cp.date DESC, cp.time ASC`
    );
    return { success: true, posts: res.rows as ContentPostRow[] };
  } catch (error) {
    console.error("Error fetching content posts:", error);
    return { error: "Failed to fetch content posts" };
  }
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

export async function createContentPost(data: {
  platform: string;
  caption: string;
  date: string;
  time: string;
  status: string;
  notes: string;
  ownerUserIds: number[];
}) {
  try {
    const session = await requireDepartmentManagerSession("PR & Social");
    const actorUserId = getSessionUserId(session);
    const res = await pool.query(
      `INSERT INTO content_posts (platform, caption, date, time, status, notes, owner_user_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
      [
        data.platform,
        data.caption,
        data.date,
        data.time,
        data.status,
        data.notes,
        normalizeOwnerUserIds(data.ownerUserIds),
      ]
    );
    const createdAt = res.rows[0].created_at;

    try {
      const platformLabel = PLATFORM_LABEL[data.platform] ?? data.platform;
      await notifySubscribers({
        topic: "content",
        excludeUserId: actorUserId,
        payload: createPushNotification({
          topic: "content",
          title: `ახალი პოსტი: ${platformLabel}`,
          body: data.date
            ? `დაგეგმილია ${data.date}${data.time ? `, ${data.time}` : ""}.`
            : "კონტენტ კალენდარში ახალი პოსტი დაემატა.",
          url: "/social/calendar",
          tag: `content-post-${res.rows[0].id as number}`,
        }),
      });
    } catch (pushError) {
      console.error("Error sending content post push notification:", pushError);
    }

    return {
      success: true,
      id: res.rows[0].id as number,
      createdAt:
        createdAt instanceof Date
          ? createdAt.toISOString()
          : String(createdAt),
    };
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
    ownerUserIds: number[];
  }
) {
  try {
    const session = await requireDepartmentManagerSession("PR & Social");
    const actorUserId = getSessionUserId(session);
    await pool.query(
      `UPDATE content_posts
       SET platform=$1, caption=$2, date=$3, time=$4, status=$5, notes=$6, owner_user_ids=$7
       WHERE id=$8`,
      [
        data.platform,
        data.caption,
        data.date,
        data.time,
        data.status,
        data.notes,
        normalizeOwnerUserIds(data.ownerUserIds),
        id,
      ]
    );

    try {
      const platformLabel = PLATFORM_LABEL[data.platform] ?? data.platform;
      await notifySubscribers({
        topic: "content",
        excludeUserId: actorUserId,
        payload: createPushNotification({
          topic: "content",
          title: `პოსტი განახლდა: ${platformLabel}`,
          body: data.date
            ? `შეამოწმეთ განახლებული გეგმა ${data.date}${data.time ? `, ${data.time}` : ""}.`
            : "კონტენტ კალენდარში პოსტი განახლდა.",
          url: "/social/calendar",
          tag: `content-post-${id}`,
        }),
      });
    } catch (pushError) {
      console.error("Error sending content post update push notification:", pushError);
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating content post:", error);
    return { error: "Failed to update content post" };
  }
}

export async function deleteContentPost(id: number) {
  try {
    await requireDepartmentManagerSession("PR & Social");
    await pool.query("DELETE FROM content_posts WHERE id = $1", [id]);
    return { success: true };
  } catch (error) {
    console.error("Error deleting content post:", error);
    return { error: "Failed to delete content post" };
  }
}
