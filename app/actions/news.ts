"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAuthenticatedSession } from "@/lib/action-auth";
import { canPublishNews, getSessionUserId } from "@/lib/permissions";
import { createPushNotification, notifySubscribers } from "@/lib/push";
import { log } from "@/lib/logger";

export type DashboardNewsType = "announcement" | "event" | "project" | "review";

export interface DashboardNewsItem {
  id: string;
  source_id: number;
  type: DashboardNewsType;
  title: string;
  body: string;
  meta: string;
  href: string | null;
  created_at: string;
  author_name: string | null;
  author_user_id: number | null;
  review_status?: string;
  update_type?: string | null;
}

type AnnouncementRow = {
  id: number;
  title: string;
  body: string | null;
  created_at: Date | string;
  author_name: string | null;
  author_user_id: number | null;
};

type EventNewsRow = {
  id: number;
  title: string;
  body: string | null;
  created_at: Date | string;
  updated_at: Date | string | null;
  last_update_type: string | null;
  event_date: string | null;
  department: string | null;
};

type ProjectNewsRow = {
  id: number;
  title: string;
  body: string | null;
  created_at: Date | string;
  updated_at: Date | string | null;
  last_update_type: string | null;
  status: string | null;
  deadline: string | null;
};

function serializeTimestamp(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.replace(" ", "T");
  return value;
}

function formatLabel(value: string | null) {
  if (!value) return "";
  if (value.toLowerCase() === "all") return "All Departments";
  if (value.toLowerCase() === "pr") return "PR & Social";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateLabel(label: string, value: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return `${label} ${value}`;
  return `${label} ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export async function getDashboardNews() {
  try {
    await requireAuthenticatedSession();
    const [announcementsRes, eventsRes, projectsRes] = await Promise.all([
      pool.query(
        `SELECT
           np.id,
           np.title,
           np.body,
           (np.created_at AT TIME ZONE 'UTC')::text || 'Z' AS created_at,
           u.full_name AS author_name,
           np.created_by_user_id AS author_user_id
         FROM news_posts np
         LEFT JOIN users u ON u.id = np.created_by_user_id
         ORDER BY np.created_at DESC
         LIMIT 20`
      ),
      pool.query(
        `SELECT
           e.id,
           e.title,
           e.description AS body,
           (e.created_at AT TIME ZONE 'UTC')::text || 'Z' AS created_at,
           (e.updated_at AT TIME ZONE 'UTC')::text || 'Z' AS updated_at,
           e.last_update_type,
           e.date::text AS event_date,
           e.department
         FROM events e
         ORDER BY GREATEST(e.created_at, COALESCE(e.updated_at, e.created_at)) DESC
         LIMIT 20`
      ),
      pool.query(
        `SELECT
           p.id,
           p.name AS title,
           p.description AS body,
           (p.created_at AT TIME ZONE 'UTC')::text || 'Z' AS created_at,
           (p.updated_at AT TIME ZONE 'UTC')::text || 'Z' AS updated_at,
           p.last_update_type,
           p.status,
           p.deadline::text AS deadline
         FROM projects p
         ORDER BY GREATEST(p.created_at, COALESCE(p.updated_at, p.created_at)) DESC
         LIMIT 20`
      ),
    ]);

    const announcements = (announcementsRes.rows as AnnouncementRow[]).map(
      (item): DashboardNewsItem => ({
        id: `announcement-${item.id}`,
        source_id: item.id,
        type: "announcement",
        title: item.title,
        body: item.body ?? "",
        meta: item.author_name ? `Posted by ${item.author_name}` : "Team update",
        href: null,
        created_at: serializeTimestamp(item.created_at),
        author_name: item.author_name,
        author_user_id: item.author_user_id,
      })
    );

    const events = (eventsRes.rows as EventNewsRow[]).map(
      (item): DashboardNewsItem => {
        const updateType = item.last_update_type ?? null;
        const effectiveTimestamp =
          updateType && item.updated_at
            ? serializeTimestamp(item.updated_at)
            : serializeTimestamp(item.created_at);
        return {
          id: `event-${item.id}`,
          source_id: item.id,
          type: "event",
          title: item.title,
          body: item.body ?? "",
          meta: [formatDateLabel("Event date", item.event_date), formatLabel(item.department)]
            .filter(Boolean)
            .join(" · "),
          href: "/events",
          created_at: effectiveTimestamp,
          author_name: null,
          author_user_id: null,
          update_type: updateType,
        };
      }
    );

    const projects = (projectsRes.rows as ProjectNewsRow[]).map(
      (item): DashboardNewsItem => {
        const updateType = item.last_update_type ?? null;
        const effectiveTimestamp =
          updateType && item.updated_at
            ? serializeTimestamp(item.updated_at)
            : serializeTimestamp(item.created_at);
        return {
          id: `project-${item.id}`,
          source_id: item.id,
          type: "project",
          title: item.title,
          body: item.body ?? "",
          meta: [formatLabel(item.status), formatDateLabel("Deadline", item.deadline)]
            .filter(Boolean)
            .join(" · "),
          href: "/projects/overview",
          created_at: effectiveTimestamp,
          author_name: null,
          author_user_id: null,
          update_type: updateType,
        };
      }
    );

    const news = [...announcements, ...events, ...projects]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 30);

    // Fetch pending reviews for HEAD/ADMIN (these go to the top)
    let reviewItems: DashboardNewsItem[] = [];
    try {
      const reviewRes = await pool.query(
        `SELECT rr.id, rr.entity_type, rr.entity_id, rr.status,
                (rr.created_at AT TIME ZONE 'UTC')::text || 'Z' AS created_at,
                u.full_name as submitted_by_name,
                CASE 
                  WHEN rr.entity_type = 'project' THEN p.name
                  WHEN rr.entity_type = 'content_post' THEN cp.caption
                END as entity_name
         FROM review_requests rr
         LEFT JOIN users u ON u.id = rr.submitted_by
         LEFT JOIN projects p ON rr.entity_type = 'project' AND p.id = rr.entity_id
         LEFT JOIN content_posts cp ON rr.entity_type = 'content_post' AND cp.id = rr.entity_id
         WHERE (
           -- Only keep if the referenced entity still exists
           ((rr.entity_type = 'project' AND p.id IS NOT NULL) OR
            (rr.entity_type = 'content_post' AND cp.id IS NOT NULL))
         ) AND (
           -- Only show pending, or ones reviewed recently (last 48 hours)
           rr.status = 'pending' OR 
           (rr.reviewed_at IS NOT NULL AND rr.reviewed_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '48 hours')
         )
         ORDER BY rr.reviewed_at DESC NULLS LAST, rr.created_at DESC
         LIMIT 10`
      );

      reviewItems = reviewRes.rows.map(
        (row: {
          id: number;
          entity_type: string;
          entity_id: number;
          status: string;
          created_at: Date | string;
          submitted_by_name: string | null;
          entity_name: string | null;
        }): DashboardNewsItem => ({
          id: `review-${row.id}`,
          source_id: row.id,
          type: "review",
          title: `${row.entity_type === "project" ? "Project" : "Post"} review`,
          body: row.entity_name || "Untitled",
          meta: row.submitted_by_name
            ? `Submitted by ${row.submitted_by_name}`
            : "Submitted for review",
          href: row.entity_type === "project"
            ? `/projects?reviewId=${row.id}&projectId=${row.entity_id}`
            : `/social/calendar?reviewId=${row.id}&postId=${row.entity_id}`,
          created_at: serializeTimestamp(row.created_at),
          author_name: row.submitted_by_name,
          author_user_id: null,
          review_status: row.status,
        })
      );
    } catch {
      // Don't fail the whole query if reviews table doesn't exist
    }

    return { success: true, news, reviewItems };
  } catch (error) {
    log.error("Error fetching dashboard news", error);
    return { error: "Failed to fetch news" };
  }
}

export async function createNewsPost(data: { title: string; body: string }) {
  try {
    const session = await getSession();
    if (!session || !canPublishNews(session)) {
      return { error: "Not authorized" };
    }

    const title = data.title.trim();
    const body = data.body.trim();
    if (!title) {
      return { error: "Title is required" };
    }

    const actorUserId = getSessionUserId(session);
    const res = await pool.query(
      `INSERT INTO news_posts (title, body, created_by_user_id)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [title, body, actorUserId]
    );

    const createdAt = res.rows[0].created_at;

    try {
      await notifySubscribers({
        topic: "news",
        excludeUserId: actorUserId,
        payload: createPushNotification({
          topic: "news",
          title: title,
          body: body || "გუნდს ახალი განახლება დაემატა.",
          url: "/dashboard",
          tag: `news-${res.rows[0].id as number}`,
        }),
      });
    } catch (pushError) {
      log.error("Error sending news push notification", pushError);
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
    log.error("Error creating news post", error);
    return { error: "Failed to create news post" };
  }
}

export async function deleteNewsPost(id: number) {
  try {
    const session = await getSession();
    if (!session) return { error: "Not authorized" };

    const role = session.role.toUpperCase();
    const userId = getSessionUserId(session);

    const existing = await pool.query(
      `SELECT created_by_user_id FROM news_posts WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) return { error: "Post not found" };

    const createdBy = existing.rows[0].created_by_user_id as number | null;
    const isOwner = userId !== null && createdBy === userId;
    const isAdmin = role === "ADMIN";
    const isHeadOwner = role === "HEAD" && isOwner;

    if (!isAdmin && !isHeadOwner) {
      return { error: "Not authorized to delete this post" };
    }

    await pool.query(`DELETE FROM news_posts WHERE id = $1`, [id]);
    return { success: true };
  } catch (error) {
    log.error("Error deleting news post", error);
    return { error: "Failed to delete news post" };
  }
}
