"use server";

// Voice assistant tool implementations. Each function receives the resolved
// (session, userId, args) triple from the dispatcher — they do NOT call
// require*Session() themselves (the dispatcher already did, gated by the
// `requires` field in config.ts). Each tool returns the data the AI will
// receive; the dispatcher wraps it in `{ success: true, data: ... }`.
//
// Reuse strategy: thin tools that pass through to existing server actions
// (getDailyBriefingForToday, getPendingAttendancePrompt, getWorkloadData,
// getAttendanceStats, getPendingReviews) re-call those actions — they're
// idempotent and re-check auth, which is a defense-in-depth bonus.

import { pool } from "@/lib/db";
import { getDailyBriefingForToday } from "@/app/actions/ai";
import { getPendingAttendancePrompt, getAttendanceStats } from "@/app/actions/attendance";
import { getWorkloadData } from "@/app/actions/workload";
import { getPendingReviews } from "@/app/actions/reviews";
import { getSocialStats } from "@/lib/queries/social";
import { isUsableQuery, sanitizeUser, truncate } from "@/lib/voice-assistant/util";

// ── Existing 8 tools (moved here so the dispatcher just imports) ────────────

export async function tool_getDashboardOverview() {
  const res = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM projects)                                       AS total_projects,
      (SELECT COUNT(*)::int FROM projects WHERE status = 'in_progress')          AS active_projects,
      (SELECT COUNT(*)::int FROM projects WHERE status = 'planning')             AS planning_projects,
      (SELECT COUNT(*)::int FROM projects WHERE status = 'review')               AS review_projects,
      (SELECT COUNT(*)::int FROM events WHERE date >= CURRENT_DATE)              AS upcoming_events,
      (SELECT COUNT(*)::int FROM events WHERE date = CURRENT_DATE)               AS today_events,
      (SELECT COUNT(*)::int FROM users)                                          AS total_members,
      (SELECT COUNT(*)::int FROM content_posts WHERE status = 'scheduled')       AS scheduled_posts,
      (SELECT COUNT(*)::int FROM inventory_items WHERE status = 'checked_out')   AS items_checked_out
  `);
  const row = res.rows[0];
  return {
    today: new Date().toISOString().slice(0, 10),
    projects: {
      total: row.total_projects,
      active: row.active_projects,
      planning: row.planning_projects,
      inReview: row.review_projects,
    },
    events: { today: row.today_events, upcoming: row.upcoming_events },
    team: { total: row.total_members },
    content: { scheduled: row.scheduled_posts },
    inventory: { checkedOut: row.items_checked_out },
  };
}

export async function tool_getUpcomingEvents(args: { daysAhead?: number }) {
  const days = Math.min(Math.max(Number(args.daysAhead ?? 7), 1), 30);
  const res = await pool.query(
    `SELECT title, TO_CHAR(date, 'YYYY-MM-DD') AS date, time, location, department
     FROM events
     WHERE date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int
     ORDER BY date ASC, time ASC
     LIMIT 20`,
    [days]
  );
  return { daysAhead: days, count: res.rows.length, events: res.rows };
}

export async function tool_getProjectsSummary() {
  const counts = await pool.query(`
    SELECT status, COUNT(*)::int AS count FROM projects GROUP BY status
  `);
  const active = await pool.query(`
    SELECT name, priority, TO_CHAR(deadline, 'YYYY-MM-DD') AS deadline
    FROM projects WHERE status = 'in_progress'
    ORDER BY
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
      deadline NULLS LAST
    LIMIT 8
  `);
  const byStatus: Record<string, number> = {};
  for (const r of counts.rows) byStatus[r.status] = r.count;
  return { countsByStatus: byStatus, activeProjects: active.rows };
}

export async function tool_getMyAssignments(userId: number) {
  const OWNER = `$1 = ANY(COALESCE(NULLIF(owner_user_ids, '{}'), CASE WHEN owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[owner_user_id] END))`;
  const [projects, events, content] = await Promise.all([
    pool.query(
      `SELECT name, status, priority, TO_CHAR(deadline, 'YYYY-MM-DD') AS deadline
       FROM projects WHERE status != 'completed' AND (${OWNER})
       ORDER BY deadline NULLS LAST LIMIT 10`,
      [userId]
    ),
    pool.query(
      `SELECT title, TO_CHAR(date, 'YYYY-MM-DD') AS date, time, location
       FROM events WHERE date >= CURRENT_DATE AND (${OWNER})
       ORDER BY date ASC LIMIT 10`,
      [userId]
    ),
    pool.query(
      `SELECT platform, status, TO_CHAR(date, 'YYYY-MM-DD') AS date, LEFT(caption, 80) AS caption_preview
       FROM content_posts WHERE status != 'published' AND (${OWNER})
       ORDER BY date ASC LIMIT 10`,
      [userId]
    ),
  ]);
  return {
    projects: projects.rows,
    events: events.rows,
    contentPosts: content.rows,
  };
}

export async function tool_getSocialStats() {
  const stats = await getSocialStats();
  return Object.values(stats).map((s) => ({
    platform: s.platform,
    name: s.name,
    followers: s.followers,
    dailyGrowth: s.daily_growth,
    weeklyGrowth: s.weekly_growth,
    monthlyGrowth: s.monthly_growth,
    lastUpdated: s.last_updated,
  }));
}

export async function tool_getTeamRoster(args: { department?: string }) {
  const filtered = !!(args.department && args.department.trim());
  const res = await pool.query(
    filtered
      ? `SELECT full_name, role, department, position
         FROM users WHERE LOWER(department) = LOWER($1)
         ORDER BY role DESC, full_name ASC`
      : `SELECT full_name, role, department, position
         FROM users ORDER BY department ASC, role DESC, full_name ASC`,
    filtered ? [args.department] : []
  );
  return {
    count: res.rows.length,
    members: res.rows.map((m) => ({
      name: m.full_name,
      role: m.role,
      department: m.department,
      position: m.position,
    })),
  };
}

export async function tool_searchProjects(args: { query?: string }) {
  if (!isUsableQuery(args.query)) {
    return { count: 0, projects: [], note: "query must be at least 3 characters" };
  }
  const q = args.query.trim();
  const res = await pool.query(
    `SELECT
       p.name, p.status, p.priority,
       TO_CHAR(p.deadline, 'YYYY-MM-DD') AS deadline,
       COALESCE(
         ARRAY(
           SELECT u.full_name FROM users u
           WHERE u.id = ANY(COALESCE(NULLIF(p.owner_user_ids, '{}'), CASE WHEN p.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[p.owner_user_id] END))
         ),
         '{}'::text[]
       ) AS owners
     FROM projects p
     WHERE p.name ILIKE '%' || $1 || '%'
     ORDER BY p.updated_at DESC LIMIT 5`,
    [q]
  );
  return { count: res.rows.length, projects: res.rows };
}

export async function tool_getDashboardNavigationHelp() {
  return {
    pages: [
      { path: "/", purpose: "Main dashboard with daily briefing, KPI tiles, and a news feed." },
      { path: "/projects", purpose: "Kanban-style project board with status columns and priority tags." },
      { path: "/projects/overview", purpose: "Table view of every project with filters and bulk actions." },
      { path: "/projects/impact", purpose: "Impact records tied to projects — people reached, evidence links." },
      { path: "/events", purpose: "List and calendar view of all events. Add new events from here." },
      { path: "/attendance", purpose: "Track member attendance for meetings and events (HEAD/ADMIN view of stats)." },
      { path: "/social", purpose: "Social media stats (Instagram, TikTok, Facebook) with follower history charts." },
      { path: "/social/calendar", purpose: "Content calendar for scheduled and draft posts." },
      { path: "/team", purpose: "Directory of all members with role and department." },
      { path: "/inventory", purpose: "Inventory items and check-out tracking." },
      { path: "/expenses", purpose: "Expense log with categories and totals." },
      { path: "/workload", purpose: "Per-member workload distribution (HEAD/ADMIN only)." },
      { path: "/admin", purpose: "Admin panel — user management, role assignment, push notifications." },
    ],
    tips: [
      "The sidebar can be collapsed via the arrow button at the bottom.",
      "Push notifications can be enabled from the sidebar to get reminders.",
      "The voice assistant icon (next to the FLHUB logo) is me — tap it any time to talk.",
    ],
  };
}

// ── New Tier 1 ──────────────────────────────────────────────────────────────

export async function tool_getTodaysBriefing() {
  const result = await getDailyBriefingForToday();
  if (!result.success) return { error: result.error, briefing: null };
  return {
    briefing: result.briefing,
    date: result.briefingDate,
    generated: result.alreadyGenerated,
  };
}

export async function tool_getMyToday(userId: number) {
  const OWNER = `$1 = ANY(COALESCE(NULLIF(owner_user_ids, '{}'), CASE WHEN owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[owner_user_id] END))`;
  const results = await Promise.allSettled([
    pool.query(
      `SELECT title, time, location, department
       FROM events
       WHERE date = CURRENT_DATE AND (${OWNER})
       ORDER BY time ASC LIMIT 10`,
      [userId]
    ),
    pool.query(
      `SELECT name, priority, TO_CHAR(deadline, 'YYYY-MM-DD') AS deadline
       FROM projects
       WHERE status NOT IN ('completed','rejected')
         AND deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
         AND (${OWNER})
       ORDER BY deadline ASC LIMIT 10`,
      [userId]
    ),
    getPendingAttendancePrompt(),
  ]);
  let partial = false;
  const todaysEvents = results[0].status === "fulfilled" ? results[0].value.rows : (partial = true, []);
  const deadlines = results[1].status === "fulfilled" ? results[1].value.rows : (partial = true, []);
  const pendingAttendanceResult = results[2].status === "fulfilled" ? results[2].value : null;
  const pendingAttendance =
    pendingAttendanceResult && "prompt" in pendingAttendanceResult
      ? pendingAttendanceResult.prompt
      : null;
  if (results[2].status !== "fulfilled") partial = true;
  return { todaysEvents, deadlinesThisWeek: deadlines, pendingAttendance, partial };
}

export async function tool_getPendingAttendance() {
  const result = await getPendingAttendancePrompt();
  if ("error" in result) return { error: result.error, prompt: null };
  return { prompt: result.prompt };
}

export async function tool_getEventDetails(args: { query?: string }) {
  if (!isUsableQuery(args.query)) {
    return { error: "query must be at least 3 characters", event: null };
  }
  const q = args.query.trim();
  const eventRes = await pool.query(
    `SELECT
       e.id,
       e.title,
       TO_CHAR(e.date, 'YYYY-MM-DD') AS date,
       e.time, e.end_time, e.location, e.department,
       LEFT(COALESCE(e.description, ''), 240) AS description_preview,
       COALESCE(
         ARRAY(
           SELECT u.full_name FROM users u
           WHERE u.id = ANY(COALESCE(NULLIF(e.owner_user_ids, '{}'), CASE WHEN e.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[e.owner_user_id] END))
         ),
         '{}'::text[]
       ) AS owners
     FROM events e
     WHERE e.title ILIKE '%' || $1 || '%'
     ORDER BY ABS(e.date - CURRENT_DATE) ASC
     LIMIT 1`,
    [q]
  );
  const event = eventRes.rows[0];
  if (!event) return { event: null, message: "no matching event" };

  const attendance = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE r.status = 'present')::int AS present,
       COUNT(*) FILTER (WHERE r.status = 'absent')::int  AS absent,
       COUNT(*) FILTER (WHERE r.status = 'excused')::int AS excused,
       COUNT(*) FILTER (WHERE r.status = 'pending')::int AS pending
     FROM attendance_sessions s
     JOIN attendance_records r ON r.session_id = s.id
     WHERE s.event_id = $1`,
    [event.id]
  );

  return { event, attendance: attendance.rows[0] ?? null };
}

export async function tool_getMemberInfo(args: { name?: string }) {
  if (!isUsableQuery(args.name)) {
    return { error: "name must be at least 3 characters", member: null };
  }
  const q = args.name.trim();
  const res = await pool.query(
    `SELECT full_name, role, department, position, email, phone_number
     FROM users
     WHERE full_name ILIKE '%' || $1 || '%'
     ORDER BY full_name ASC
     LIMIT 1`,
    [q]
  );
  const row = res.rows[0];
  if (!row) return { member: null };
  return { member: sanitizeUser(row) };
}

export async function tool_getInventoryStatus(args: { query?: string }) {
  const filtered = !!(args.query && args.query.trim().length >= 3);
  const q = filtered ? args.query!.trim() : null;
  const res = await pool.query(
    filtered
      ? `SELECT i.name, i.category, i.quantity, i.status, i.location, i.condition,
                co.person AS current_holder, TO_CHAR(co.checkout_date, 'YYYY-MM-DD') AS checked_out_on
         FROM inventory_items i
         LEFT JOIN LATERAL (
           SELECT person, checkout_date FROM inventory_checkouts
           WHERE item_id = i.id AND return_date IS NULL
           ORDER BY checkout_date DESC LIMIT 1
         ) co ON true
         WHERE i.name ILIKE '%' || $1 || '%'
         ORDER BY i.name ASC LIMIT 10`
      : `SELECT i.name, i.category, i.quantity, i.status, i.location, i.condition,
                co.person AS current_holder, TO_CHAR(co.checkout_date, 'YYYY-MM-DD') AS checked_out_on
         FROM inventory_items i
         LEFT JOIN LATERAL (
           SELECT person, checkout_date FROM inventory_checkouts
           WHERE item_id = i.id AND return_date IS NULL
           ORDER BY checkout_date DESC LIMIT 1
         ) co ON true
         ORDER BY i.created_at DESC LIMIT 10`,
    filtered ? [q] : []
  );
  return { count: res.rows.length, items: res.rows };
}

// ── New Tier 2 ──────────────────────────────────────────────────────────────

export async function tool_getProjectDetails(args: { name?: string }) {
  if (!isUsableQuery(args.name)) {
    return { error: "name must be at least 3 characters", project: null };
  }
  const q = args.name.trim();
  const projectRes = await pool.query(
    `SELECT
       p.id, p.name, p.status, p.priority,
       TO_CHAR(p.deadline, 'YYYY-MM-DD') AS deadline,
       LEFT(COALESCE(p.description, ''), 240) AS description_preview,
       p.team, p.review_status,
       COALESCE(
         ARRAY(
           SELECT u.full_name FROM users u
           WHERE u.id = ANY(COALESCE(NULLIF(p.owner_user_ids, '{}'), CASE WHEN p.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[p.owner_user_id] END))
         ),
         '{}'::text[]
       ) AS owners
     FROM projects p
     WHERE p.name ILIKE '%' || $1 || '%'
     ORDER BY p.updated_at DESC LIMIT 1`,
    [q]
  );
  const project = projectRes.rows[0];
  if (!project) return { project: null, message: "no matching project" };

  const [impact, latestReview] = await Promise.all([
    pool.query(
      `SELECT activity_type, people_reached, TO_CHAR(date, 'YYYY-MM-DD') AS date,
              LEFT(result_summary, 100) AS summary_preview
       FROM impact_records
       WHERE project_id = $1
       ORDER BY date DESC LIMIT 5`,
      [project.id]
    ),
    pool.query(
      `SELECT status, TO_CHAR(created_at, 'YYYY-MM-DD') AS submitted_on,
              LEFT(COALESCE(feedback, ''), 200) AS feedback
       FROM review_requests
       WHERE entity_type = 'project' AND entity_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [project.id]
    ),
  ]);

  return {
    project,
    impactRecords: impact.rows,
    latestReview: latestReview.rows[0] ?? null,
  };
}

export async function tool_getContentCalendar(args: { daysAhead?: number }) {
  const days = Math.min(Math.max(Number(args.daysAhead ?? 7), 1), 30);
  const res = await pool.query(
    `SELECT
       platform, status, TO_CHAR(date, 'YYYY-MM-DD') AS date, time,
       LEFT(caption, 80) AS caption_preview,
       approval_status
     FROM content_posts
     WHERE status = 'scheduled'
       AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int
     ORDER BY date ASC, time ASC LIMIT 20`,
    [days]
  );
  return { daysAhead: days, count: res.rows.length, posts: res.rows };
}

export async function tool_getMonthlySpending(args: { category?: string }) {
  const category = args.category?.trim();
  const totalRes = await pool.query(
    category
      ? `SELECT
           COALESCE(SUM(amount)::float, 0) AS total,
           COUNT(*)::int AS count
         FROM expenses
         WHERE date >= date_trunc('month', CURRENT_DATE)::date
           AND LOWER(category) = LOWER($1)`
      : `SELECT
           COALESCE(SUM(amount)::float, 0) AS total,
           COUNT(*)::int AS count
         FROM expenses
         WHERE date >= date_trunc('month', CURRENT_DATE)::date`,
    category ? [category] : []
  );
  const byCategory = await pool.query(
    `SELECT category, SUM(amount)::float AS total, COUNT(*)::int AS count
     FROM expenses
     WHERE date >= date_trunc('month', CURRENT_DATE)::date
     GROUP BY category
     ORDER BY total DESC LIMIT 5`
  );
  return {
    monthStart: new Date().toISOString().slice(0, 7) + "-01",
    filterCategory: category ?? null,
    total: totalRes.rows[0].total,
    count: totalRes.rows[0].count,
    topCategories: byCategory.rows,
  };
}

export async function tool_getRecentImpact(args: { months?: number }) {
  const months = Math.min(Math.max(Number(args.months ?? 3), 1), 12);
  const res = await pool.query(
    `SELECT
       activity_type,
       SUM(people_reached)::int AS total_reached,
       COUNT(*)::int AS record_count
     FROM impact_records
     WHERE date >= CURRENT_DATE - ($1::int || ' months')::interval
     GROUP BY activity_type
     ORDER BY total_reached DESC`,
    [months]
  );
  const total = res.rows.reduce((sum, r) => sum + r.total_reached, 0);
  return { monthsBack: months, totalReached: total, byActivityType: res.rows };
}

export async function tool_getDeadlinesThisWeek() {
  const res = await pool.query(`
    SELECT 'project' AS kind, name AS label, TO_CHAR(deadline, 'YYYY-MM-DD') AS date, priority AS extra
      FROM projects
      WHERE status NOT IN ('completed','rejected')
        AND deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
    UNION ALL
    SELECT 'event', title, TO_CHAR(date, 'YYYY-MM-DD'), department
      FROM events
      WHERE date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
    UNION ALL
    SELECT 'content', LEFT(caption, 60), TO_CHAR(date, 'YYYY-MM-DD'), platform
      FROM content_posts
      WHERE status = 'scheduled'
        AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
    ORDER BY date ASC
    LIMIT 15
  `);
  return { count: res.rows.length, items: res.rows };
}

// ── New Tier 3 ──────────────────────────────────────────────────────────────

export async function tool_getOverdueProjects() {
  const res = await pool.query(`
    SELECT name, priority, status,
           TO_CHAR(deadline, 'YYYY-MM-DD') AS deadline,
           (CURRENT_DATE - deadline) AS days_overdue
    FROM projects
    WHERE deadline < CURRENT_DATE
      AND status NOT IN ('completed','rejected')
    ORDER BY deadline ASC LIMIT 10
  `);
  return { count: res.rows.length, projects: res.rows };
}

export async function tool_getMemberAttendanceRate(userId: number) {
  // IMPORTANT: always uses session.userId — any memberId argument from the
  // model is intentionally ignored. The AI cannot look up other members.
  const res = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE r.status <> 'pending')::int                 AS responded,
       COUNT(*) FILTER (WHERE r.status = 'present')::int                  AS present,
       COUNT(*) FILTER (WHERE r.status = 'absent')::int                   AS absent,
       COUNT(*) FILTER (WHERE r.status = 'excused')::int                  AS excused,
       COUNT(*) FILTER (WHERE r.status = 'pending')::int                  AS still_pending,
       ROUND(
         (COUNT(*) FILTER (WHERE r.status = 'present'))::numeric * 100 /
         NULLIF((COUNT(*) FILTER (WHERE r.status <> 'pending'))::numeric, 0),
         1
       )::float AS rate_percent
     FROM attendance_records r
     WHERE r.user_id = $1`,
    [userId]
  );
  return { ...res.rows[0], note: "Always your own stats — cannot query other members." };
}

export async function tool_getLatestNews(args: { n?: number }) {
  const n = Math.min(Math.max(Number(args.n ?? 5), 1), 10);
  const res = await pool.query(
    `SELECT
       n.title,
       LEFT(COALESCE(n.body, ''), 240) AS body_preview,
       TO_CHAR(n.created_at, 'YYYY-MM-DD') AS created_on,
       u.full_name AS author
     FROM news_posts n
     LEFT JOIN users u ON u.id = n.created_by_user_id
     ORDER BY n.created_at DESC
     LIMIT $1`,
    [n]
  );
  return {
    count: res.rows.length,
    news: res.rows.map((r) => ({
      ...r,
      body_preview: truncate(r.body_preview, 240),
    })),
  };
}

export async function tool_getCheckoutHistory(args: { itemName?: string }) {
  if (!isUsableQuery(args.itemName)) {
    return { error: "itemName must be at least 3 characters", checkouts: [] };
  }
  const res = await pool.query(
    `SELECT
       i.name AS item,
       c.person,
       TO_CHAR(c.checkout_date, 'YYYY-MM-DD') AS checked_out_on,
       TO_CHAR(c.return_date, 'YYYY-MM-DD')   AS returned_on
     FROM inventory_checkouts c
     JOIN inventory_items i ON i.id = c.item_id
     WHERE i.name ILIKE '%' || $1 || '%'
     ORDER BY c.checkout_date DESC LIMIT 5`,
    [args.itemName!.trim()]
  );
  return { count: res.rows.length, checkouts: res.rows };
}

export async function tool_searchEvents(args: { query?: string }) {
  if (!isUsableQuery(args.query)) {
    return { count: 0, events: [], note: "query must be at least 3 characters" };
  }
  const res = await pool.query(
    `SELECT title, TO_CHAR(date, 'YYYY-MM-DD') AS date, time, location, department
     FROM events
     WHERE title ILIKE '%' || $1 || '%'
     ORDER BY date DESC LIMIT 5`,
    [args.query!.trim()]
  );
  return { count: res.rows.length, events: res.rows };
}

export async function tool_searchMembers(args: { query?: string }) {
  if (!isUsableQuery(args.query)) {
    return { count: 0, members: [], note: "query must be at least 3 characters" };
  }
  const res = await pool.query(
    `SELECT full_name, role, department, position, email, phone_number
     FROM users
     WHERE full_name ILIKE '%' || $1 || '%'
     ORDER BY full_name ASC LIMIT 5`,
    [args.query!.trim()]
  );
  return {
    count: res.rows.length,
    members: res.rows.map((m) => sanitizeUser(m)),
  };
}

// ── headOrAdmin tier ────────────────────────────────────────────────────────

export async function tool_getPendingApprovals() {
  const result = await getPendingReviews();
  if (result.error) return { error: result.error, count: 0, reviews: [] };
  return {
    count: result.reviews.length,
    reviews: result.reviews.slice(0, 10).map((r) => ({
      entity_type: r.entity_type,
      entity_name: truncate(r.entity_name ?? "", 80),
      submitted_by: r.submitted_by_name,
      submitted_on: r.created_at,
    })),
  };
}

export async function tool_getWorkloadOverview() {
  const result = await getWorkloadData();
  if ("error" in result) return { error: result.error };
  const { members } = result;
  const topBusy = [...members]
    .sort((a, b) => (b.activeProjects + b.upcomingEvents) - (a.activeProjects + a.upcomingEvents))
    .slice(0, 5)
    .map((m) => ({
      name: m.name,
      department: m.department,
      activeProjects: m.activeProjects,
      upcomingEvents: m.upcomingEvents,
    }));
  return {
    teamSize: members.length,
    totalActiveProjects: members.reduce((s, m) => s + m.activeProjects, 0),
    totalUpcomingEvents: members.reduce((s, m) => s + m.upcomingEvents, 0),
    topBusy,
  };
}

export async function tool_getAttendanceStats() {
  const result = await getAttendanceStats();
  if (!result || "error" in result) {
    return { error: ("error" in (result ?? {}) ? (result as { error?: string }).error : null) ?? "failed" };
  }
  // The action returns { summary, members[], departments[] }. Summarize.
  const r = result as {
    summary?: Record<string, unknown>;
    members?: Array<{ member_name: string; present_count: number; recorded_count: number }>;
    departments?: Array<{ department: string; present_count: number; recorded_count: number }>;
  };
  return {
    summary: r.summary ?? null,
    topMembers: (r.members ?? [])
      .slice()
      .sort((a, b) => b.present_count - a.present_count)
      .slice(0, 5),
    departments: r.departments ?? [],
  };
}

