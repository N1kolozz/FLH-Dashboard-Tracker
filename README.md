# FLH Dashboard & Social Media Tracker

A full-stack operational dashboard for the **Future Leaders Hub (FLH)**. It combines a secure Role-Based Access Control (RBAC) internal portal with automated social media growth tracking across Instagram, TikTok, and Facebook.

## Features

### Role-Based Access Control (RBAC)
- **Authentication:** Secure JWT-based sessions (stored in HttpOnly cookies).
- **Onboarding Flow:** Admins/Heads pre-add users via the dashboard. Users activate accounts via an email-linked `/create-password` flow.
- **Roles & Permissions:**
  - **ADMIN:** Full access. Can add/edit/delete any member and assign HEAD/ADMIN roles.
  - **HEAD:** Department leadership access. Can add members (MEMBER role only) and edit member details (name, department, position). Cannot edit ADMINs.
  - **MEMBER:** Read-only access to team directories and restricted department functionalities. Cannot add or edit members.
- **Department Isolation:** Functional restrictions are enforced server-side based on the user's role and department.

### Social Media Tracker
- **Automated Scraping:** Daily follower counts using **Meta Graph API** (Instagram/Facebook) and **Playwright** (TikTok). Runs via GitHub Actions.
- **Data Visualization:** Historical growth charts (30 days / 90 days / All time) and aggregate overview statistics.
- **PostgreSQL Storage:** Daily snapshots and profile stats.

---

## Setup & Deployment

### 1. Environment Variables
Copy `.env.local.example` to `.env.local` and add:
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=your-secure-jwt-secret-key  # Required for production, has fallback for local dev
CRON_SECRET=your-secret-key-here
APP_TIMEZONE=Asia/Tbilisi
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=https://your-domain.com  # Or mailto:admin@example.com
META_ACCESS_TOKEN=...
FB_PAGE_ID=...
IG_ACCOUNT_ID=...
```

### 2. Database Migration
Creates required tables (`users`, `social_accounts`, `follower_history`) and seeds the default admin account:
```bash
npm run migrate
```
*Note: Ensure you update the default admin credentials in `scripts/migrate.ts` before running.*

### 3. Development Server
```bash
npm run dev
```

### 4. PWA Push Notifications
Generate VAPID keys for web push:
```bash
npm run generate:vapid
```

Then add the generated values to `.env.local`, run the migration, and enable alerts from the dashboard inside the installed PWA on mobile.

---

## Project Structure

```
flh-dashboard/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx         # Login portal
│   │   └── create-password/       # Account activation for pre-added users
│   ├── actions/                   # Server Actions (Auth, Members, Session management)
│   ├── dashboard/                 # Main stats overview
│   ├── team/                      # Team directory & RBAC management
│   ├── api/                       # REST endpoints (Stats, Scrape trigger)
│   ├── events/                    # Shared department pages...
│   ├── logistics/
│   ├── projects/
│   └── social/
├── components/                    # Reusable UI components (Sidebar, TopNav, Modals, Charts)
├── lib/
│   ├── auth.ts                    # JWT creation, verification, and session utilities
│   └── db.ts                      # PostgreSQL connection pool
├── scripts/
│   ├── migrate.ts                 # Database schema initialization
│   └── scrapeFollowers.ts         # Social media scraping script
└── middleware.ts                  # Route protection and RBAC enforcement
```

---

## Database Schema

```sql
-- Internal Team Members (RBAC)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,         -- System Role: ADMIN, HEAD, MEMBER
  department VARCHAR(100) NOT NULL,  -- e.g., Logistics, PR & Social
  position VARCHAR(255) DEFAULT '',  -- Job Title: e.g., Coordinator
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tracked Social Accounts
CREATE TABLE social_accounts (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily Follower Snapshots
CREATE TABLE follower_history (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES social_accounts(id),
  followers INTEGER NOT NULL,
  total_likes INTEGER,               -- Profile stats
  posts_count INTEGER,
  recorded_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, recorded_date)
);
```

---

## Access Control Flow (How it works)

1. **Route Protection:** `middleware.ts` runs on every request. It skips auth routes (`/login`, `/create-password`) and API endpoints, but intercepts all other routes to verify the JWT session cookie. If missing or invalid, the user is redirected to `/login`.
2. **Action Guards:** Database mutations via Server Actions (e.g., `app/actions/members.ts`) independently verify `getSession()` to ensure the user has the required `role` (ADMIN/HEAD) before executing queries.
3. **UI Adapters:** Client components use the session state to conditionally render action buttons (like the "+ Add Member" button or Edit/Delete icons) ensuring a clean UI for restricted users.

## Notes on Scraping (GitHub Actions)
Playwright/Chromium cannot run on Vercel’s serverless runtime. Therefore, the daily social media scrape is executed via a scheduled **GitHub Actions** workflow (`.github/workflows/scrape.yml`). Ensure `DATABASE_URL` is set in your repository secrets so the workflow can save data remotely.
