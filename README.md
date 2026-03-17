# FLH Social Media Growth Dashboard

A full-stack analytics dashboard for **Future Leaders Hub** that tracks daily follower growth across Instagram, TikTok and Facebook.

## Features

- Daily automated follower count collection via Playwright (runs in **GitHub Actions**, not on Vercel)
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
```

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

Playwright/Chromium cannot run on Vercel’s serverless runtime, so scraping runs in **GitHub Actions** instead.

### 1. Add repository secrets

In your GitHub repo: **Settings → Secrets and variables → Actions**. Add:

| Secret            | Description |
|-------------------|-------------|
| `DATABASE_URL`    | Same PostgreSQL connection string as in Vercel (e.g. Neon/Railway). The workflow uses it to save scraped data. |
| `APP_TIMEZONE`    | Optional timezone for recording dates (example: `Africa/Cairo`). Set this as a **Repository variable** in GitHub Actions (`Settings → Secrets and variables → Actions → Variables`). If missing, defaults to `UTC`. |

### 2. Schedule and manual run

- **Schedule:** The workflow runs daily at **06:00 UTC** (edit `.github/workflows/scrape.yml` to change the cron).
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
│   └── scrapeFollowers.ts    # Playwright scraper
├── .github/workflows/
│   └── scrape.yml            # Scheduled + manual scrape (Playwright)
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

Instagram, TikTok, and Facebook all use aggressive anti-bot measures. The scraper uses best-effort extraction from page meta descriptions and structured data. If a platform blocks the scrape, it logs the error and skips that platform — data shows as **N/A** on the dashboard.

For more reliable data collection, consider official APIs where available:
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api/)
- [TikTok Research API](https://developers.tiktok.com/products/research-api/) (requires application)
