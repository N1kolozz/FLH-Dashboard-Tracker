"use server";

import { pool } from "@/lib/db";
import {
  requireAuthenticatedSession,
  requireHeadOrAdminSession,
} from "@/lib/action-auth";
import { getSessionUserId } from "@/lib/permissions";

// Review workflow types
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

type ReviewEntityType = ReviewRequest["entity_type"];
type ReviewStatusSnapshot = {
  status: ReviewRequest["status"];
  reviewId: number;
  feedback: string | null;
};
type ReviewStatusMap = Record<number, ReviewStatusSnapshot>;
type LatestReviewStatusRow = {
  entity_id: number;
  review_id: number;
  status: ReviewRequest["status"];
  feedback: string | null;
};

// Shared by the project board and social calendar to avoid duplicate
// "latest review per entity" queries drifting apart over time.
async function getLatestReviewStatuses(
  entityType: ReviewEntityType
): Promise<ReviewStatusMap> {
  const res = await pool.query<LatestReviewStatusRow>(
    `SELECT DISTINCT ON (rr.entity_id)
            rr.id as review_id,
            rr.entity_id,
            rr.status,
            rr.feedback
     FROM review_requests rr
     WHERE rr.entity_type = $1
     ORDER BY rr.entity_id, rr.created_at DESC`,
    [entityType]
  );

  const reviewStatuses: ReviewStatusMap = {};
  for (const row of res.rows) {
    reviewStatuses[row.entity_id] = {
      status: row.status,
      reviewId: row.review_id,
      feedback: row.feedback,
    };
  }

  return reviewStatuses;
}

// Submit for review and mirror the pending state on the target entity so list
// views can show the status without joining review_requests every time.
export async function submitForReview(
  entityType: ReviewEntityType,
  entityId: number
) {
  try {
    const session = await requireAuthenticatedSession();
    const userId = getSessionUserId(session);

    const existing = await pool.query(
      `SELECT id FROM review_requests 
       WHERE entity_type = $1 AND entity_id = $2 AND status = 'pending'`,
      [entityType, entityId]
    );
    if (existing.rows.length > 0) {
      return { error: "Already submitted for review" };
    }

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
      [entityType, entityId, userId]
    );

    return { success: true, id: res.rows[0].id };
  } catch (error) {
    console.error("Error submitting for review:", error);
    return { error: "Failed to submit for review" };
  }
}

// Approve review requests and keep the target entity visible with approved status.
export async function approveReview(reviewId: number, feedback?: string) {
  try {
    const session = await requireHeadOrAdminSession();
    const userId = getSessionUserId(session);

    const reviewRes = await pool.query(
      `SELECT * FROM review_requests WHERE id = $1 AND status = 'pending'`,
      [reviewId]
    );
    if (reviewRes.rows.length === 0) {
      return { error: "Review not found or already processed" };
    }

    const review = reviewRes.rows[0];

    await pool.query(
      `UPDATE review_requests 
       SET status = 'approved', 
           reviewed_by = $1, 
           feedback = $2,
           reviewed_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
       WHERE id = $3`,
      [userId, feedback || null, reviewId]
    );

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

// Reject review requests. Projects are kept as rejected records with feedback;
// content posts are removed because rejected drafts should no longer appear.
export async function rejectReview(reviewId: number, feedback: string) {
  try {
    const session = await requireHeadOrAdminSession();
    const userId = getSessionUserId(session);

    if (!feedback || !feedback.trim()) {
      return { error: "Feedback is required when rejecting" };
    }

    const reviewRes = await pool.query(
      `SELECT * FROM review_requests WHERE id = $1 AND status = 'pending'`,
      [reviewId]
    );
    if (reviewRes.rows.length === 0) {
      return { error: "Review not found or already processed" };
    }

    const review = reviewRes.rows[0];

    await pool.query(
      `UPDATE review_requests 
       SET status = 'rejected', 
           reviewed_by = $1, 
           feedback = $2,
           reviewed_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
       WHERE id = $3`,
      [userId, feedback.trim(), reviewId]
    );

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

// Get review status for one entity detail view.
export async function getReviewForEntity(
  entityType: ReviewEntityType,
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

// Get pending reviews for HEAD/ADMIN and ignore stale requests whose target was deleted.
export async function getPendingReviews(): Promise<{
  reviews: ReviewRequest[];
  error?: string;
}> {
  try {
    await requireHeadOrAdminSession();

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

// Batch review status helpers used by project and content-post list screens.
export async function getProjectReviewStatuses(): Promise<ReviewStatusMap> {
  try {
    return await getLatestReviewStatuses("project");
  } catch (error) {
    console.error("Error fetching review statuses:", error);
    return {};
  }
}

export async function getPostReviewStatuses(): Promise<ReviewStatusMap> {
  try {
    return await getLatestReviewStatuses("content_post");
  } catch (error) {
    console.error("Error fetching post review statuses:", error);
    return {};
  }
}
