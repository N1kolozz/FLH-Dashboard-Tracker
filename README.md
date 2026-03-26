# FLH Social Media Growth Dashboard

A full-stack analytics dashboard for **Future Leaders Hub** that tracks daily follower growth across Instagram, TikTok and Facebook.

## Features

- Daily automated follower counts: **Meta Graph API** for Instagram and Facebook, **Playwright** for TikTok (runs in **GitHub Actions**, not on Vercel)
- Historical growth charts (30 days / 90 days / All time)
- Per-platform stats: current followers, daily/weekly/monthly growth
- Aggregate overview statistics
- PostgreSQL data storage with daily snapshots
- Optional: trigger scrape from API (dispatches GitHub Actions workflow)

## Tracked Accounts

| Platform  | Account |
|-----------|---------|
| Instagram | [@future_leaders_hub](https://www.instagram.com/future_leaders_hub/) |
| TikTok    | [@future_leaders_hub](https://www.tiktok.com/@future_leaders_hub) |
| Facebook  | [Future Leaders Hub](https://www.facebook.com/profile.php?id=61556110770300) |

---

## Setup

### 1. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
CRON_SECRET=your-secret-key-here
APP_TIMEZONE=Africa/Cairo
META_ACCESS_TOKEN=...   # for local `npm run scrape` (Instagram + Facebook)
FB_PAGE_ID=...
IG_ACCOUNT_ID=...
```

See [walkthrough.md](walkthrough.md) for Meta app permissions and how to obtain these IDs and token.

**Recommended PostgreSQL providers:** [Neon](https://neon.tech) (free tier), [Railway](https://railway.app), [Render](https://render.com)

### 2. Run database migration

This creates the tables and seeds the 3 FLH accounts:

```bash
npm run migrate
```

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

### 4. Trigger your first scrape (local)

Run the script directly:

```bash
npm run scrape
```

---

## GitHub Actions (scraping on deploy)

Playwright/Chromium cannot run on Vercel’s serverless runtime, so the TikTok scrape runs in **GitHub Actions** together with Meta Graph API calls for Instagram and Facebook.

### 1. Add repository secrets

In your GitHub repo: **Settings → Secrets and variables → Actions**. Add:

| Secret               | Description |
|----------------------|-------------|
| `DATABASE_URL`       | Same PostgreSQL connection string as in Vercel (e.g. Neon/Railway). The workflow uses it to save scraped data. |
| `META_ACCESS_TOKEN`  | Long-lived Page access token from Meta (Graph API Explorer or your app). Needs `pages_read_engagement`, `pages_show_list`, `instagram_basic`. |
| `FB_PAGE_ID`         | Facebook Page ID for the Graph API. |
| `IG_ACCOUNT_ID`      | Instagram Business Account ID linked to that page. |
| `APP_TIMEZONE`       | Optional timezone for recording dates (example: `Africa/Cairo`). Set this as a **Repository variable** in GitHub Actions (`Settings → Secrets and variables → Actions → Variables`). If missing, defaults to `UTC`. |

### 2. Schedule and manual run

- **Schedule:** The workflow runs **three times daily** at **08:00, 17:00, and 22:00 Asia/Tbilisi** (mapped to UTC in `.github/workflows/scrape.yml`; GitHub cron is always UTC).
- **Manual run:** In GitHub go to **Actions → “Scrape followers” → Run workflow**.

### 3. (Optional) Trigger from Vercel / cron

To have your existing scrape URL trigger the workflow (e.g. from Vercel Cron or cron-job.org), set these in **Vercel → Project → Settings → Environment Variables**:

| Variable               | Description |
|------------------------|-------------|
| `GITHUB_REPO`          | Repo in the form `owner/repo`, e.g. `myorg/flh-dashboard`. |
| `GITHUB_ACTIONS_TOKEN` | A [Personal Access Token](https://github.com/settings/tokens) with `repo` scope (or fine-grained with “Actions: write”). |

Then `POST /api/scrape?key=YOUR_CRON_SECRET` will trigger the “Scrape followers” workflow and return immediately; the actual scrape runs in GitHub Actions.

---

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/stats` | Current followers + daily/weekly/monthly growth |
| `GET`  | `/api/history?platform=instagram&range=30` | Historical data for charts |
| `POST` | `/api/scrape?key=CRON_SECRET` | Trigger scrape (dispatches GitHub Actions if `GITHUB_REPO` + `GITHUB_ACTIONS_TOKEN` are set) |

**History query params:**
- `platform`: `instagram` \| `tiktok` \| `facebook`
- `range`: `30` \| `90` \| `all` (default: `30`)

---

## Deployment (Vercel + Neon)

### 1. Deploy to Vercel

```bash
npx vercel --prod
```

### 2. Add environment variables in Vercel Dashboard

- `DATABASE_URL` — your Neon/Railway connection string
- `CRON_SECRET` — your secret key
- `APP_TIMEZONE` — your local timezone (example: `Africa/Cairo`) so `recorded_date` matches your day
- (Optional) `GITHUB_REPO` and `GITHUB_ACTIONS_TOKEN` — to trigger the scrape workflow from `/api/scrape` (see GitHub Actions section above)

### 3. Scraping (GitHub Actions)

Scraping is handled by the **GitHub Actions** workflow (`.github/workflows/scrape.yml`), not by Vercel. Add `DATABASE_URL` as a repository secret and run the workflow on schedule or manually. If you set `GITHUB_REPO` and `GITHUB_ACTIONS_TOKEN` on Vercel, you can keep calling `/api/scrape` (e.g. from [cron-job.org](https://cron-job.org)); that endpoint will trigger the workflow.

---

## Project Structure

```
flh-dashboard/
├── app/
│   ├── dashboard/
│   │   └── page.tsx          # Main dashboard UI
│   ├── api/
│   │   ├── stats/route.ts    # GET follower stats + growth
│   │   ├── history/route.ts  # GET historical data
│   │   └── scrape/route.ts   # POST trigger scrape (dispatches GitHub Actions)
│   ├── layout.tsx
│   └── page.tsx              # Redirects to /dashboard
├── components/
│   ├── PlatformCard.tsx      # Per-platform stat card
│   ├── GrowthChart.tsx       # Chart.js line chart
│   └── DashboardStats.tsx    # Aggregate summary stats
├── lib/
│   └── db.ts                 # PostgreSQL pool
├── scripts/
│   ├── migrate.ts            # DB schema + seed
│   └── scrapeFollowers.ts    # Meta Graph API (IG/FB) + Playwright (TikTok)
├── .github/workflows/
│   └── scrape.yml            # Scheduled + manual scrape (Graph API + Playwright)
├── .env.local.example
├── vercel.json
└── tsconfig.scripts.json     # TS config for Node scripts
```

---

## Database Schema

```sql
-- Tracked social accounts
CREATE TABLE social_accounts (
  id           SERIAL PRIMARY KEY,
  platform     VARCHAR(50) NOT NULL,
  name         VARCHAR(255),
  url          TEXT NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily follower snapshots
CREATE TABLE follower_history (
  id             SERIAL PRIMARY KEY,
  account_id     INTEGER REFERENCES social_accounts(id),
  followers      INTEGER NOT NULL,
  recorded_date  DATE NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, recorded_date)
);
```

---

## Notes on Scraping

Instagram and Facebook metrics come from the **Meta Graph API** (see [walkthrough.md](walkthrough.md) for setup). TikTok still uses a **Playwright** profile scrape; if TikTok blocks the run, that platform logs an error and may carry forward the last saved values.

For TikTok, an official option is the [TikTok Research API](https://developers.tiktok.com/products/research-api/) (requires application).
