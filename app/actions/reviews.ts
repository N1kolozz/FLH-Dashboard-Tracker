"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";

/* ─── Types ─── */

export interface ReviewRequest {
  id: number;
  entity_type: "project" | "content_post";
  entity_id: number;
  status: "pending" | "approved" | "rejected";
  submitted_by: number | null;
  reviewed_by: number | null;
  feedback: string | null;
  created_at: string;
  reviewed_at: string | null;
  submitted_by_name?: string;
  reviewed_by_name?: string;
  entity_name?: string;
}

/* ─── Auth helpers ─── */

async function assertAuthenticated() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

async function assertHeadOrAdmin() {
  const session = await assertAuthenticated();
  if (session.role !== "HEAD" && session.role !== "ADMIN") {
    throw new Error("Only HEAD or ADMIN can review");
  }
  return session;
}

/* ─── Submit for Review ─── */

export async function submitForReview(
  entityType: "project" | "content_post",
  entityId: number
) {
  try {
    const session = await assertAuthenticated();
    const userId = Number(session.userId);

    // Check if there's already a pending review
    const existing = await pool.query(
      `SELECT id FROM review_requests 
       WHERE entity_type = $1 AND entity_id = $2 AND status = 'pending'`,
      [entityType, entityId]
    );
    if (existing.rows.length > 0) {
      return { error: "Already submitted for review" };
    }

    // Update the entity's review status
    if (entityType === "project") {
      await pool.query(
        `UPDATE projects SET review_status = 'pending' WHERE id = $1`,
        [entityId]
      );
    } else {
      await pool.query(
        `UPDATE content_posts SET approval_status = 'pending' WHERE id = $1`,
        [entityId]
      );
    }

    const res = await pool.query(
      `INSERT INTO review_requests (entity_type, entity_id, submitted_by)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [entityType, entityId, Number.isInteger(userId) ? userId : null]
    );

    return { success: true, id: res.rows[0].id };
  } catch (error) {
    console.error("Error submitting for review:", error);
    return { error: "Failed to submit for review" };
  }
}

/* ─── Approve Review ─── */

export async function approveReview(reviewId: number, feedback?: string) {
  try {
    const session = await assertHeadOrAdmin();
    const userId = Number(session.userId);

    // Get the review
    const reviewRes = await pool.query(
      `SELECT * FROM review_requests WHERE id = $1 AND status = 'pending'`,
      [reviewId]
    );
    if (reviewRes.rows.length === 0) {
      return { error: "Review not found or already processed" };
    }

    const review = reviewRes.rows[0];

    // Update review status
    await pool.query(
      `UPDATE review_requests 
       SET status = 'approved', 
           reviewed_by = $1, 
           feedback = $2,
           reviewed_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
       WHERE id = $3`,
      [Number.isInteger(userId) ? userId : null, feedback || null, reviewId]
    );

    // Update entity review status
    if (review.entity_type === "project") {
      await pool.query(
        `UPDATE projects SET review_status = 'approved' WHERE id = $1`,
        [review.entity_id]
      );
    } else {
      await pool.query(
        `UPDATE content_posts SET approval_status = 'approved' WHERE id = $1`,
        [review.entity_id]
      );
    }

    return { success: true };
  } catch (error) {
    console.error("Error approving review:", error);
    return { error: "Failed to approve" };
  }
}

/* ─── Reject Review ─── */

export async function rejectReview(reviewId: number, feedback: string) {
  try {
    const session = await assertHeadOrAdmin();
    const userId = Number(session.userId);

    if (!feedback || !feedback.trim()) {
      return { error: "Feedback is required when rejecting" };
    }

    // Get the review
    const reviewRes = await pool.query(
      `SELECT * FROM review_requests WHERE id = $1 AND status = 'pending'`,
      [reviewId]
    );
    if (reviewRes.rows.length === 0) {
      return { error: "Review not found or already processed" };
    }

    const review = reviewRes.rows[0];

    // Update review status
    await pool.query(
      `UPDATE review_requests 
       SET status = 'rejected', 
           reviewed_by = $1, 
           feedback = $2,
           reviewed_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
       WHERE id = $3`,
      [Number.isInteger(userId) ? userId : null, feedback.trim(), reviewId]
    );

    // On reject: mark project as rejected (soft-delete) or delete content post
    if (review.entity_type === "project") {
      await pool.query(
        `UPDATE projects SET status = 'rejected', review_status = 'rejected' WHERE id = $1`,
        [review.entity_id]
      );
    } else {
      await pool.query(`DELETE FROM content_posts WHERE id = $1`, [review.entity_id]);
    }

    return { success: true };
  } catch (error) {
    console.error("Error rejecting review:", error);
    return { error: "Failed to reject" };
  }
}

/* ─── Get review status for an entity ─── */

export async function getReviewForEntity(
  entityType: "project" | "content_post",
  entityId: number
): Promise<{ review: ReviewRequest | null }> {
  try {
    const res = await pool.query(
      `SELECT rr.*, 
              u1.full_name as submitted_by_name, 
              u2.full_name as reviewed_by_name
       FROM review_requests rr
       LEFT JOIN users u1 ON u1.id = rr.submitted_by
       LEFT JOIN users u2 ON u2.id = rr.reviewed_by
       WHERE rr.entity_type = $1 AND rr.entity_id = $2
       ORDER BY rr.created_at DESC
       LIMIT 1`,
      [entityType, entityId]
    );
    return { review: res.rows[0] || null };
  } catch (error) {
    console.error("Error fetching review:", error);
    return { review: null };
  }
}

/* ─── Get all pending reviews (for HEAD/ADMIN) ─── */

export async function getPendingReviews(): Promise<{
  reviews: ReviewRequest[];
  error?: string;
}> {
  try {
    await assertHeadOrAdmin();

    const res = await pool.query(
      `SELECT rr.*,
              u1.full_name as submitted_by_name,
              u2.full_name as reviewed_by_name,
              CASE 
                WHEN rr.entity_type = 'project' THEN p.name
                WHEN rr.entity_type = 'content_post' THEN cp.caption
              END as entity_name
       FROM review_requests rr
       LEFT JOIN users u1 ON u1.id = rr.submitted_by
       LEFT JOIN users u2 ON u2.id = rr.reviewed_by
       LEFT JOIN projects p ON rr.entity_type = 'project' AND p.id = rr.entity_id
       LEFT JOIN content_posts cp ON rr.entity_type = 'content_post' AND cp.id = rr.entity_id
       WHERE rr.status = 'pending'
         AND (
           (rr.entity_type = 'project' AND p.id IS NOT NULL) OR
           (rr.entity_type = 'content_post' AND cp.id IS NOT NULL)
         )
       ORDER BY rr.created_at DESC`
    );

    return { reviews: res.rows };
  } catch (error) {
    console.error("Error fetching pending reviews:", error);
    return { reviews: [], error: "Failed to fetch pending reviews" };
  }
}

/* ─── Get all review statuses for projects (batch) ─── */

export async function getProjectReviewStatuses(): Promise<
  Record<number, { status: string; reviewId: number; feedback: string | null }>
> {
  try {
    const res = await pool.query(
      `SELECT DISTINCT ON (rr.entity_id)
              rr.id as review_id,
              rr.entity_id,
              rr.status,
              rr.feedback
       FROM review_requests rr
       WHERE rr.entity_type = 'project'
       ORDER BY rr.entity_id, rr.created_at DESC`
    );

    const map: Record<number, { status: string; reviewId: number; feedback: string | null }> = {};
    for (const row of res.rows) {
      map[row.entity_id] = {
        status: row.status,
        reviewId: row.review_id,
        feedback: row.feedback,
      };
    }
    return map;
  } catch (error) {
    console.error("Error fetching review statuses:", error);
    return {};
  }
}

/* ─── Get all review statuses for content posts (batch) ─── */

export async function getPostReviewStatuses(): Promise<
  Record<number, { status: string; reviewId: number; feedback: string | null }>
> {
  try {
    const res = await pool.query(
      `SELECT DISTINCT ON (rr.entity_id)
              rr.id as review_id,
              rr.entity_id,
              rr.status,
              rr.feedback
       FROM review_requests rr
       WHERE rr.entity_type = 'content_post'
       ORDER BY rr.entity_id, rr.created_at DESC`
    );

    const map: Record<number, { status: string; reviewId: number; feedback: string | null }> = {};
    for (const row of res.rows) {
      map[row.entity_id] = {
        status: row.status,
        reviewId: row.review_id,
        feedback: row.feedback,
      };
    }
    return map;
  } catch (error) {
    console.error("Error fetching post review statuses:", error);
    return {};
  }
}
