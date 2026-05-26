"use server";

import { pool } from "@/lib/db";
import { requireAuthenticatedSession, requireDepartmentManagerSession } from "@/lib/action-auth";
import { normalizeOwnerUserIds } from "@/lib/owner-users";
import { createPushNotification, notifySubscribers } from "@/lib/push";
import { getSessionUserId } from "@/lib/permissions";
import { log } from "@/lib/logger";

export interface ContentPostRow {
  id: number;
  platform: string;
  caption: string;
  date: string;
  time: string;
  status: string;
  notes: string;
  owner_user_ids: number[];
  approval_status: string;
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
         cp.approval_status,
         cp.created_at
       FROM content_posts cp
       ORDER BY cp.date DESC, cp.time ASC`
    );
    return { success: true, posts: res.rows as ContentPostRow[] };
  } catch (error) {
    log.error("Error fetching content posts", error);
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
      log.error("Error sending content post push notification", pushError);
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
    log.error("Error creating content post", error);
    return { error: "Failed to create content post" };
  }
}

// Compares the old DB row with the incoming update and returns a label for
// what changed. Drives the "Updated" badge in the dashboard news feed.
// Priority: status > date > time > platform > caption > notes > details.
function detectContentPostUpdateType(
  oldRow: {
    platform: string;
    caption: string;
    date: string | null;
    time: string | null;
    status: string;
    notes: string | null;
  },
  next: {
    platform: string;
    caption: string;
    date: string;
    time: string;
    status: string;
    notes: string;
  }
): string {
  if ((oldRow.status ?? "") !== (next.status ?? "")) return "status";
  const oldDate = (oldRow.date ?? "").split("T")[0].split(" ")[0];
  if (oldDate !== (next.date ?? "")) return "date";
  if ((oldRow.time ?? "") !== (next.time ?? "")) return "time";
  if ((oldRow.platform ?? "") !== (next.platform ?? "")) return "platform";
  if ((oldRow.caption ?? "") !== (next.caption ?? "")) return "caption";
  if ((oldRow.notes ?? "") !== (next.notes ?? "")) return "notes";
  return "details";
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

    const oldRes = await pool.query(
      `SELECT platform, caption, date::text AS date, time, status, notes, approval_status
       FROM content_posts WHERE id = $1`,
      [id]
    );
    const oldRow = oldRes.rows[0];

    // Non-HEAD/ADMIN users cannot set status to "published" without approval
    const isHeadOrAdmin = session.role === "ADMIN" || session.role === "HEAD";
    if (data.status === "published" && !isHeadOrAdmin) {
      const approvalStatus = (oldRow?.approval_status ?? "") as string;
      if (approvalStatus !== "approved") {
        return { error: "This post must be approved by a HEAD before it can be published." };
      }
    }

    const lastUpdateType = oldRow
      ? detectContentPostUpdateType(oldRow, data)
      : "details";

    await pool.query(
      `UPDATE content_posts
       SET platform=$1, caption=$2, date=$3, time=$4, status=$5, notes=$6, owner_user_ids=$7,
           updated_at=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
           last_update_type=$9
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
        lastUpdateType,
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
      log.error("Error sending content post update push notification", pushError);
    }

    return { success: true };
  } catch (error) {
    log.error("Error updating content post", error);
    return { error: "Failed to update content post" };
  }
}

export async function deleteContentPost(id: number) {
  try {
    await requireDepartmentManagerSession("PR & Social");
    await pool.query("DELETE FROM content_posts WHERE id = $1", [id]);
    return { success: true };
  } catch (error) {
    log.error("Error deleting content post", error);
    return { error: "Failed to delete content post" };
  }
}
