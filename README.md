# FLHub Dashboard & Social Media Tracker

A full-stack operational dashboard for **Future Leaders Hub (FLHUB)**. It combines a secure Role-Based Access Control (RBAC) internal portal with automated social media growth tracking across Instagram, TikTok, and Facebook.

---

## Features

### Role-Based Access Control (RBAC)
- **Authentication:** Secure hand-rolled JWT sessions (HttpOnly cookie, 7-day expiry, HMAC-SHA256 via Web Crypto API — no `jose` dependency).
- **Onboarding Flow:** Admins/Heads pre-add users via the Team page. A user whose email exists but has no password is redirected to `/create-password` on first sign-in.
- **Roles & Permissions:**
  - **ADMIN:** Full access. Can add/edit/delete any member and assign HEAD/ADMIN roles.
  - **HEAD:** Department leadership. Can add members (MEMBER role only) and edit member details. Cannot edit ADMINs.
  - **MEMBER:** Read-only on team directory; limited department-specific actions.
- **Department Isolation:** Functional restrictions are enforced server-side — nav filtering is UI-only convenience, not a security boundary.

### Department Modules
- **PR & Social:** Analytics (follower history charts), Content Calendar (post scheduling per platform).
- **Projects:** Kanban board (DnD Kit), project overview, impact/outcomes records, review/approval workflow.
- **Logistics:** Inventory management (checkout/checkin flow), expense tracking.
- **Organization:** Events with attendance tracking, team directory, workload view, monthly summary.
- **System:** Admin panel (user management, activity logs).

### Social Media Tracker
- **Automated Scraping:** Daily follower counts via Meta Graph API (Instagram/Facebook) and Playwright (TikTok). Runs on a GitHub Actions schedule — cannot run on Vercel due to Chromium.
- **Data Visualization:** Historical growth charts (30 / 90 / All time) with daily, weekly, and monthly growth deltas.
- **PostgreSQL Storage:** Daily snapshots per platform in `follower_history`.

---

## Setup & Deployment

### 1. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=your-secure-random-secret          # Required in production; local dev falls back to a built-in dev-only value
GEMINI_API_KEY=...                            # Google Generative AI (daily briefings, itinerary generation)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...              # Web Push (must be NEXT_PUBLIC_ so the browser can read it)
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=https://your-domain.com         # Or mailto:admin@example.com
META_ACCESS_TOKEN=...                         # Facebook/Instagram Graph API (scraper)
FB_PAGE_ID=...                               # Facebook Page node ID
IG_ACCOUNT_ID=...                            # Instagram Business Account node ID
```

Optional bootstrap admin (only used by `npm run migrate`):
```
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_FULL_NAME=Admin User
SEED_ADMIN_DEPARTMENT=Management
SEED_ADMIN_POSITION=Director
```

If `SEED_ADMIN_EMAIL` is set, the migration creates that user with ADMIN role only if the email does not already exist. The first sign-in redirects to `/create-password` to set the initial password.

### 2. Database Migration

```bash
npm run migrate
```

Creates all tables and seeds social_accounts + optional admin. Migrations are additive — safe to re-run.

### 3. Development Server

```bash
npm run dev   # Listens on 0.0.0.0 — accessible over LAN for mobile PWA testing
```

### 4. PWA Push Notifications (one-time setup)

```bash
npm run generate:vapid   # Prints VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
```

Add the output to `.env.local`, re-run `npm run migrate`, then enable notifications from the installed PWA.

---

## Project Structure

```
├── app/
│   ├── (app)/                    # All protected pages — layout applies session check + pending-attendance prompt
│   │   ├── layout.tsx            # Mounts Sidebar, ActivityTracker, AttendancePrompt, PageTransition
│   │   ├── dashboard/            # Main stats overview with AI daily briefing
│   │   ├── social/               # Analytics page + content calendar
│   │   ├── projects/             # Kanban board, overview, impact records
│   │   ├── logistics/            # Inventory + expenses
│   │   ├── events/               # Organization events
│   │   ├── attendance/           # Attendance session management
│   │   ├── team/                 # Team directory + workload view
│   │   ├── summary/              # Monthly summary (HEAD+ only)
│   │   └── admin/                # Admin panel (ADMIN only)
│   ├── (auth)/                   # Public auth pages — no session required
│   │   ├── login/
│   │   └── create-password/
│   ├── actions/                  # "use server" files — the primary mutation/query layer
│   │   ├── auth.ts               # login, logout, createPassword
│   │   ├── members.ts            # addMember, updateMember, deleteMember, getMembers
│   │   ├── projects.ts           # project CRUD + push notifications
│   │   ├── events.ts             # event CRUD with multi-owner + attendance audience
│   │   ├── attendance.ts         # session management + record updates
│   │   ├── ai.ts                 # Gemini: itinerary generation + daily briefings
│   │   ├── content-posts.ts      # Social calendar CRUD
│   │   ├── expenses.ts           # Expense CRUD
│   │   ├── inventory.ts          # Inventory + checkout/checkin
│   │   ├── impact.ts             # Impact records
│   │   ├── reviews.ts            # Review/approval workflow
│   │   ├── news.ts               # News posts
│   │   ├── session.ts            # Session cookie management helpers
│   │   ├── tracking.ts           # pingSession, trackPageView, endSession
│   │   ├── monthly-summary.ts    # Aggregated monthly stats
│   │   ├── workload.ts           # Workload data aggregation
│   │   └── dashboard-stats.ts    # Dashboard KPI aggregation
│   ├── api/                      # REST endpoints (push subscription, holidays, stats, history)
│   ├── layout.tsx                # Root layout — fonts, PWA metadata, global CSS
│   ├── manifest.ts               # Web App Manifest (dynamic, typed)
│   ├── apple-icon.tsx            # Dynamic apple-touch-icon via next/og
│   └── pwa-icon/[size]/          # Dynamic PWA icons at /pwa-icon/[size] (Edge Runtime)
│
├── components/                   # Shared, reusable React components
│   ├── Sidebar.tsx               # Collapsible nav, role-filtered links, logout
│   ├── ActivityTracker.tsx       # Invisible — session heartbeat + page view tracking
│   ├── AutoRefresh.tsx           # Invisible — polls router.refresh() on an interval
│   ├── AttendancePrompt.tsx      # Modal shown when a pending attendance record exists
│   ├── FixedPortal.tsx           # React portal to document.body (fixes CSS transform stacking)
│   ├── PageTransition.tsx        # Re-keys wrapper div on pathname change to trigger CSS animation
│   ├── PushNotificationManager.tsx  # Service worker subscription UI (3 variants)
│   ├── PwaRegistrar.tsx          # Registers /sw.js on mount
│   ├── Modal.tsx                 # Generic modal wrapper
│   ├── ConfirmDialog.tsx         # Reusable confirmation dialog
│   ├── MemberMultiSelect.tsx     # Multi-select dropdown for owner assignment
│   ├── Icons.tsx                 # All SVG icons as React components
│   └── ui/                       # Low-level UI primitives (Select, etc.)
│
├── features/                     # Feature-scoped UI + data model bundles
│   │                             # Use for complex features with their own types, display
│   │                             # configs, and sort/filter logic that doesn't belong in a
│   │                             # single page file. Each sub-folder exports model.ts (types +
│   │                             # pure logic) and ui.tsx (React components for that feature).
│   ├── projects/
│   │   ├── board/                # Kanban board — DnD Kit columns, card, modals
│   │   │   ├── model.ts          # Project type, COLUMNS, PRIORITY_CONFIG, sort/filter helpers
│   │   │   └── ui.tsx            # BoardColumn, ProjectCard, CreateProjectModal, etc.
│   │   ├── overview/             # Project overview grid
│   │   │   ├── model.ts
│   │   │   └── ui.tsx
│   │   └── impact/               # Impact/outcomes records
│   │       ├── model.ts
│   │       └── skeletons.tsx
│   └── social/
│       └── calendar/             # Content calendar (month/week views, post cards)
│           ├── model.ts          # ContentPost type, PLATFORM_CONFIG, STATUS_CONFIG
│           ├── ui.tsx
│           └── skeletons.tsx
│
├── lib/                          # Shared server-side utilities (never imported by client components directly)
│   ├── db.ts                     # pg Pool singleton (hot-reload safe via global._pgPool)
│   ├── session-token.ts          # Hand-rolled JWT: encrypt / decrypt (Web Crypto, no jose)
│   ├── auth.ts                   # getSession() / updateSession() — reads the cookie
│   ├── action-auth.ts            # requireAuthenticatedSession / requireHeadOrAdminSession / requireDepartmentManagerSession
│   ├── permissions.ts            # Pure boolean helpers: isHeadOrAdmin, canManageDepartment, etc.
│   ├── activity.ts               # logActivity() — writes to user_activities table
│   ├── owner-users.ts            # normalizeOwnerUserIds, indexRowsByOwner
│   ├── calendar-ui.ts            # getMonthDays, MONTHS, WEEKDAYS — shared calendar helpers
│   ├── avatar-colors.ts          # Deterministic color assignment for member avatars
│   ├── member-avatar.ts          # Avatar URL / initials helpers
│   ├── loading-skeleton.ts       # Skeleton count persistence helpers
│   ├── public-holidays.ts        # Georgian public holidays data
│   ├── push.ts                   # Web Push sending via VAPID
│   ├── dal/
│   │   └── projects.ts           # Data Access Layer for projects table (raw SQL functions)
│   └── queries/
│       └── social.ts             # Social stats + history queries (unstable_cache wrapped)
│
├── config/
│   └── navigation.ts             # NAV_SECTIONS — sidebar links with permission flags
│
├── types/
│   └── index.ts                  # Shared TypeScript types (ProjectRow, etc.)
│
├── scripts/
│   ├── migrate.ts                # Additive SQL migrations — run with npm run migrate
│   └── scrapeFollowers.ts        # Meta Graph API + Playwright TikTok scraper
│
├── public/
│   └── sw.js                     # Service worker (manual, no Workbox)
│
├── middleware.ts                 # Edge: session gate — redirect unauthenticated requests to /login
└── next.config.mjs               # Cache headers for PWA assets
```

---

## Database Schema

All timestamps are stored in UTC. Tbilisi (UTC+4) formatting is applied at display time.

```sql
-- ── Users & Auth ────────────────────────────────────────────────────────────

CREATE TABLE users (
  id           SERIAL PRIMARY KEY,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),            -- NULL until the user completes /create-password
  full_name    VARCHAR(255) NOT NULL,
  role         VARCHAR(50)  NOT NULL,    -- 'ADMIN' | 'HEAD' | 'MEMBER'
  department   VARCHAR(100) NOT NULL,    -- e.g. 'Management', 'Projects', 'PR & Social'
  position     VARCHAR(255) DEFAULT '',  -- Job title
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Activity Tracking ────────────────────────────────────────────────────────

CREATE TABLE user_sessions (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
  start_time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_ping        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INTEGER DEFAULT 0,
  ip_address       VARCHAR(45) DEFAULT '',
  user_agent       TEXT DEFAULT '',
  is_active        BOOLEAN DEFAULT TRUE
);

CREATE TABLE user_activities (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES user_sessions(id) ON DELETE SET NULL,
  action     VARCHAR(255) NOT NULL,  -- e.g. 'page_view', 'create_project'
  path       VARCHAR(255) DEFAULT '',
  details    JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45) DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Social Media ─────────────────────────────────────────────────────────────

CREATE TABLE social_accounts (
  id         SERIAL PRIMARY KEY,
  platform   VARCHAR(50) NOT NULL,  -- 'instagram' | 'tiktok' | 'facebook'
  name       VARCHAR(255),
  url        TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE follower_history (
  id            SERIAL PRIMARY KEY,
  account_id    INTEGER REFERENCES social_accounts(id),
  followers     INTEGER NOT NULL,
  total_likes   INTEGER,    -- Facebook fan_count; Instagram N/A
  posts_count   INTEGER,    -- Instagram media_count
  recorded_date DATE NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, recorded_date)
);

-- ── Projects ─────────────────────────────────────────────────────────────────

CREATE TABLE projects (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  description      TEXT DEFAULT '',
  status           VARCHAR(50) NOT NULL DEFAULT 'planning',  -- planning | in_progress | review | completed | rejected
  priority         VARCHAR(50) NOT NULL DEFAULT 'medium',    -- low | medium | high
  deadline         DATE,
  team             VARCHAR(255) DEFAULT '',
  tags             TEXT[] DEFAULT '{}',
  owner_user_ids   INTEGER[] NOT NULL DEFAULT '{}',          -- array of user IDs (multi-owner)
  owner_user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- legacy single-owner (kept for migration compatibility)
  review_status    VARCHAR(50) NOT NULL DEFAULT 'not_requested',
  last_update_type TEXT,   -- 'status' | 'deadline' | 'priority' | 'name' | 'description' | 'details'
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE review_requests (
  id           SERIAL PRIMARY KEY,
  entity_type  VARCHAR(50) NOT NULL,  -- 'project' | 'content_post'
  entity_id    INTEGER NOT NULL,
  status       VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  feedback     TEXT DEFAULT '',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at  TIMESTAMP
);

CREATE TABLE impact_records (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  project_name    VARCHAR(255) NOT NULL,
  activity_type   VARCHAR(50) NOT NULL DEFAULT 'other',
  people_reached  INTEGER NOT NULL DEFAULT 0,
  date            DATE NOT NULL,
  result_summary  TEXT DEFAULT '',
  evidence_link   TEXT DEFAULT '',
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Events & Attendance ──────────────────────────────────────────────────────

CREATE TABLE events (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  date            DATE NOT NULL,
  time            VARCHAR(10) DEFAULT '',
  end_time        VARCHAR(10) DEFAULT '',
  location        VARCHAR(255) DEFAULT '',
  department      VARCHAR(50) NOT NULL DEFAULT 'other',
  description     TEXT DEFAULT '',
  owner_user_ids  INTEGER[] NOT NULL DEFAULT '{}',
  owner_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- legacy
  last_update_type TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance_sessions (
  id                SERIAL PRIMARY KEY,
  event_id          INTEGER REFERENCES events(id) ON DELETE SET NULL,
  title             VARCHAR(255) NOT NULL,
  meeting_date      DATE NOT NULL,
  instructions      TEXT DEFAULT '',
  is_active         BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = members can submit their response
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance_records (
  id                 SERIAL PRIMARY KEY,
  session_id         INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status             VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | present | absent | excused
  note               TEXT DEFAULT '',    -- optional note from the member
  reason             TEXT DEFAULT '',    -- reason if absent/excused
  updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  responded_at       TIMESTAMP,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, user_id)
);

-- ── Logistics ────────────────────────────────────────────────────────────────

CREATE TABLE inventory_items (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(255) NOT NULL,
  category  VARCHAR(50) NOT NULL DEFAULT 'other',
  quantity  INTEGER NOT NULL DEFAULT 1,
  status    VARCHAR(50) NOT NULL DEFAULT 'available',  -- available | checked_out | maintenance
  location  VARCHAR(255) DEFAULT '',
  condition VARCHAR(255) DEFAULT '',
  notes     TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_checkouts (
  id            SERIAL PRIMARY KEY,
  item_id       INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  person        VARCHAR(255) NOT NULL,
  checkout_date DATE NOT NULL,
  return_date   DATE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expenses (
  id          SERIAL PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  category    VARCHAR(50) NOT NULL DEFAULT 'other',
  date        DATE NOT NULL,
  paid_by     VARCHAR(255) DEFAULT '',
  notes       TEXT DEFAULT '',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── PR & Social Content ──────────────────────────────────────────────────────

CREATE TABLE content_posts (
  id              SERIAL PRIMARY KEY,
  platform        VARCHAR(50) NOT NULL DEFAULT 'instagram',  -- instagram | tiktok | facebook
  caption         TEXT NOT NULL,
  date            DATE NOT NULL,
  time            VARCHAR(10) DEFAULT '',
  status          VARCHAR(50) NOT NULL DEFAULT 'draft',  -- draft | scheduled | published
  notes           TEXT DEFAULT '',
  owner_user_ids  INTEGER[] NOT NULL DEFAULT '{}',
  owner_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- legacy
  approval_status VARCHAR(50) NOT NULL DEFAULT 'not_requested',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Dashboard / Briefings ────────────────────────────────────────────────────

CREATE TABLE news_posts (
  id                SERIAL PRIMARY KEY,
  title             VARCHAR(255) NOT NULL,
  body              TEXT DEFAULT '',
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_briefings (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL,
  briefing      TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, briefing_date)
);

-- ── Push Notifications ───────────────────────────────────────────────────────

CREATE TABLE push_subscriptions (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
  endpoint            TEXT NOT NULL UNIQUE,
  p256dh              TEXT NOT NULL,
  auth                TEXT NOT NULL,
  user_agent          TEXT DEFAULT '',
  topic_news          BOOLEAN NOT NULL DEFAULT TRUE,
  topic_events        BOOLEAN NOT NULL DEFAULT TRUE,
  topic_projects      BOOLEAN NOT NULL DEFAULT TRUE,
  topic_attendance    BOOLEAN NOT NULL DEFAULT TRUE,
  topic_content       BOOLEAN NOT NULL DEFAULT TRUE,
  last_success_at     TIMESTAMP,
  last_failure_at     TIMESTAMP,
  last_failure_reason TEXT DEFAULT '',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Access Control Flow

1. **Route gating** — `middleware.ts` runs on every non-static request in the Edge Runtime. It decrypts the session cookie and redirects unauthenticated users to `/login`. Server action POST requests are passed through unconditionally (they guard themselves).

2. **Action guards** — every server action that mutates data calls one of:
   - `requireAuthenticatedSession()` — any logged-in user
   - `requireHeadOrAdminSession()` — HEAD or ADMIN role
   - `requireDepartmentManagerSession(dept)` — ADMIN/HEAD or matching department

3. **UI filtering** — `Sidebar.tsx` reads the session and hides links the user cannot access. This is convenience only — the server always enforces the real check.

---

## Data Flow Pattern

```
Server Component (page.tsx)
  │  calls server action directly (no fetch / React Query)
  ▼
app/actions/*.ts  ←── requireAuthenticatedSession() / requireHeadOrAdminSession()
  │  calls pool.query() or a DAL function
  ▼
lib/dal/*.ts  or  pool.query() inline
  │
  ▼
PostgreSQL (DATABASE_URL)
```

Client components receive data as props (`initialX`) from their parent server component. Mutations flow back through the same server actions via `import { action } from "@/app/actions/…"`.

The only exceptions (actual client-side `fetch` calls):
- Push subscription endpoints (`/api/push/*`)
- Holiday calendar (`/api/holidays?year=…`) — cached per year in a `useRef`

---

## PWA & Service Worker

`public/sw.js` is maintained by hand (no Workbox). Cache strategy:
- `/_next/static/**` — cache-first forever (content-hashed filenames)
- Icons + manifest — cache-first, populated on install
- Navigation requests — network-first with Navigation Preload enabled
- Push events and `notificationclick` are handled here

PWA icons are dynamically generated on the Edge Runtime at `/pwa-icon/[size]` using `next/og` + the `FlhIconMark` SVG component.

---

## Social Media Scraping

TikTok scraping uses Playwright/Chromium and **cannot run on Vercel**. It runs via a GitHub Actions workflow (`.github/workflows/scrape.yml`) on a schedule (7× daily, Tbilisi timezone). Instagram and Facebook use the Meta Graph API — see `walkthrough.md` for setup details.

---

## Key Component Patterns

| Component | Purpose |
|---|---|
| `AutoRefresh` | Polls `router.refresh()` on interval; pauses when tab is hidden |
| `ActivityTracker` | Session heartbeat (60 s ping) + page view logging; uses `pagehide` not `beforeunload` |
| `FixedPortal` | Renders fixed overlays in a React portal to `document.body` — required when a CSS `transform` parent breaks fixed positioning |
| `PageTransition` | Re-keys a wrapper `div` by `pathname` to trigger the `pageEnter` CSS animation on navigation |
| Chart components | Always loaded with `dynamic(() => import(…), { ssr: false })` to avoid Chart.js SSR errors |
