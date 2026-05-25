// Drizzle schema definition for every table in the application.
//
// This file is the SINGLE SOURCE OF TRUTH for the database structure.
// Runtime queries still use `pool.query()` with raw SQL — Drizzle is used here
// only for:
//   1. Type inference (`InferSelectModel<typeof users>` etc. — opt-in per-query)
//   2. Migration generation (`drizzle-kit generate` reads this file)
//   3. Schema documentation that lives next to the code
//
// To change the database:
//   1. Edit this file
//   2. Run `npm run db:generate`  → writes a SQL migration to drizzle/
//   3. Run `npm run db:migrate`   → applies pending migrations to DATABASE_URL
//
// All timestamps are stored as TIMESTAMP (without time zone) in UTC.
// Tbilisi (UTC+4) formatting is applied at display time.

import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  date,
  timestamp,
  jsonb,
  numeric,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ── Users & Auth ─────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  // NULL until the user completes /create-password
  passwordHash: varchar("password_hash", { length: 255 }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  // 'ADMIN' | 'HEAD' | 'MEMBER'
  role: varchar("role", { length: 50 }).notNull(),
  // e.g. 'Management', 'Projects', 'PR & Social'
  department: varchar("department", { length: 100 }).notNull(),
  position: varchar("position", { length: 255 }).default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Activity Tracking ────────────────────────────────────────────────────────

export const userSessions = pgTable(
  "user_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    startTime: timestamp("start_time").defaultNow(),
    lastPing: timestamp("last_ping").defaultNow(),
    durationSeconds: integer("duration_seconds").default(0),
    ipAddress: varchar("ip_address", { length: 45 }).default(""),
    userAgent: text("user_agent").default(""),
    isActive: boolean("is_active").default(true),
  },
  (table) => ({
    userIdIdx: index("user_sessions_user_id_idx").on(table.userId),
    startTimeIdx: index("user_sessions_start_time_idx").on(table.startTime),
  })
);

export const userActivities = pgTable(
  "user_activities",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => userSessions.id, {
      onDelete: "set null",
    }),
    // e.g. 'page_view', 'create_project', 'login'
    action: varchar("action", { length: 255 }).notNull(),
    path: varchar("path", { length: 255 }).default(""),
    details: jsonb("details").default({}),
    ipAddress: varchar("ip_address", { length: 45 }).default(""),
    userAgent: text("user_agent").default(""),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_activities_user_id_idx").on(table.userId),
    actionIdx: index("user_activities_action_idx").on(table.action),
    createdAtIdx: index("user_activities_created_at_idx").on(table.createdAt),
  })
);

// ── Social Media ─────────────────────────────────────────────────────────────

export const socialAccounts = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  // 'instagram' | 'tiktok' | 'facebook'
  platform: varchar("platform", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const followerHistory = pgTable(
  "follower_history",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id").references(() => socialAccounts.id),
    followers: integer("followers").notNull(),
    // Facebook fan_count; Instagram N/A
    totalLikes: integer("total_likes"),
    // Instagram media_count
    postsCount: integer("posts_count"),
    recordedDate: date("recorded_date").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueAccountDate: uniqueIndex("follower_history_account_id_recorded_date_key").on(
      table.accountId,
      table.recordedDate
    ),
    accountRecordedIdx: index("follower_history_account_recorded_date_idx").on(
      table.accountId,
      table.recordedDate
    ),
  })
);

// ── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").default(""),
    // planning | in_progress | review | completed | rejected
    status: varchar("status", { length: 50 }).notNull().default("planning"),
    // low | medium | high
    priority: varchar("priority", { length: 50 }).notNull().default("medium"),
    deadline: date("deadline"),
    team: varchar("team", { length: 255 }).default(""),
    tags: text("tags").array().default([]),
    // Multi-owner: preferred field. See lib/owner-users.ts for read/write helpers.
    ownerUserIds: integer("owner_user_ids").array().notNull().default([]),
    // Legacy single-owner. Kept for migration compatibility — fetch queries
    // COALESCE this into ownerUserIds when the array is empty.
    ownerUserId: integer("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewStatus: varchar("review_status", { length: 50 })
      .notNull()
      .default("not_requested"),
    // 'status' | 'deadline' | 'priority' | 'name' | 'description' | 'details'
    // Drives push notification copy after updates.
    lastUpdateType: text("last_update_type"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    reviewStatusIdx: index("projects_review_status_idx").on(table.reviewStatus),
  })
);

export const reviewRequests = pgTable(
  "review_requests",
  {
    id: serial("id").primaryKey(),
    // 'project' | 'content_post'
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: integer("entity_id").notNull(),
    // pending | approved | rejected
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    submittedBy: integer("submitted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedBy: integer("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    feedback: text("feedback").default(""),
    createdAt: timestamp("created_at").defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
  },
  (table) => ({
    entityLookupIdx: index("review_requests_entity_lookup_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    statusCreatedAtIdx: index("review_requests_status_created_at_idx").on(
      table.status,
      table.createdAt
    ),
  })
);

export const impactRecords = pgTable(
  "impact_records",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    projectName: varchar("project_name", { length: 255 }).notNull(),
    activityType: varchar("activity_type", { length: 50 }).notNull().default("other"),
    peopleReached: integer("people_reached").notNull().default(0),
    date: date("date").notNull(),
    resultSummary: text("result_summary").default(""),
    evidenceLink: text("evidence_link").default(""),
    notes: text("notes").default(""),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("impact_records_project_id_idx").on(table.projectId),
  })
);

// ── Events & Attendance ──────────────────────────────────────────────────────

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    date: date("date").notNull(),
    time: varchar("time", { length: 10 }).default(""),
    endTime: varchar("end_time", { length: 10 }).default(""),
    location: varchar("location", { length: 255 }).default(""),
    department: varchar("department", { length: 50 }).notNull().default("other"),
    description: text("description").default(""),
    ownerUserIds: integer("owner_user_ids").array().notNull().default([]),
    // Legacy single-owner.
    ownerUserId: integer("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastUpdateType: text("last_update_type"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    dateIdx: index("events_date_idx").on(table.date),
  })
);

export const attendanceSessions = pgTable(
  "attendance_sessions",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    meetingDate: date("meeting_date").notNull(),
    instructions: text("instructions").default(""),
    // TRUE = members can submit their response
    isActive: boolean("is_active").notNull().default(false),
    createdByUserId: integer("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    eventIdIdx: index("attendance_sessions_event_id_idx").on(table.eventId),
    activeIdx: index("attendance_sessions_active_idx").on(table.isActive),
  })
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // pending | present | absent | excused
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    note: text("note").default(""),
    reason: text("reason").default(""),
    updatedByUserId: integer("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    uniqueSessionUser: uniqueIndex("attendance_records_session_user_idx").on(
      table.sessionId,
      table.userId
    ),
    userStatusIdx: index("attendance_records_user_status_idx").on(
      table.userId,
      table.status
    ),
  })
);

// ── Logistics ────────────────────────────────────────────────────────────────

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull().default("other"),
  quantity: integer("quantity").notNull().default(1),
  // available | checked_out | maintenance
  status: varchar("status", { length: 50 }).notNull().default("available"),
  location: varchar("location", { length: 255 }).default(""),
  condition: varchar("condition", { length: 255 }).default(""),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventoryCheckouts = pgTable("inventory_checkouts", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  person: varchar("person", { length: 255 }).notNull(),
  checkoutDate: date("checkout_date").notNull(),
  returnDate: date("return_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: varchar("description", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  category: varchar("category", { length: 50 }).notNull().default("other"),
  date: date("date").notNull(),
  paidBy: varchar("paid_by", { length: 255 }).default(""),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── PR & Social Content ──────────────────────────────────────────────────────

export const contentPosts = pgTable(
  "content_posts",
  {
    id: serial("id").primaryKey(),
    // instagram | tiktok | facebook
    platform: varchar("platform", { length: 50 }).notNull().default("instagram"),
    caption: text("caption").notNull(),
    date: date("date").notNull(),
    time: varchar("time", { length: 10 }).default(""),
    // draft | scheduled | published
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    notes: text("notes").default(""),
    ownerUserIds: integer("owner_user_ids").array().notNull().default([]),
    // Legacy single-owner.
    ownerUserId: integer("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvalStatus: varchar("approval_status", { length: 50 })
      .notNull()
      .default("not_requested"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    dateTimeIdx: index("content_posts_date_time_idx").on(table.date, table.time),
    approvalStatusIdx: index("content_posts_approval_status_idx").on(table.approvalStatus),
  })
);

// ── Dashboard / Briefings ────────────────────────────────────────────────────

export const newsPosts = pgTable(
  "news_posts",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").default(""),
    createdByUserId: integer("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    createdAtIdx: index("news_posts_created_at_idx").on(table.createdAt),
  })
);

export const dailyBriefings = pgTable(
  "daily_briefings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    briefingDate: date("briefing_date").notNull(),
    briefing: text("briefing").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    uniqueUserDate: uniqueIndex("daily_briefings_user_id_briefing_date_key").on(
      table.userId,
      table.briefingDate
    ),
    userDateIdx: index("daily_briefings_user_date_idx").on(
      table.userId,
      table.briefingDate
    ),
  })
);

// ── Push Notifications ───────────────────────────────────────────────────────

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent").default(""),
    topicNews: boolean("topic_news").notNull().default(true),
    topicEvents: boolean("topic_events").notNull().default(true),
    topicProjects: boolean("topic_projects").notNull().default(true),
    topicAttendance: boolean("topic_attendance").notNull().default(true),
    topicContent: boolean("topic_content").notNull().default(true),
    lastSuccessAt: timestamp("last_success_at"),
    lastFailureAt: timestamp("last_failure_at"),
    lastFailureReason: text("last_failure_reason").default(""),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("push_subscriptions_user_id_idx").on(table.userId),
  })
);
