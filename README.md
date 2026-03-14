# FLH Social Media Growth Dashboard

A full-stack analytics dashboard for **Future Leaders Hub** that tracks daily follower growth across Instagram, TikTok, and Facebook.

## Features

- Daily automated follower count collection via Playwright
- Historical growth charts (30 days / 90 days / All time)
- Per-platform stats: current followers, daily/weekly/monthly growth
- Aggregate overview statistics
- PostgreSQL data storage with daily snapshots
- Secure scrape trigger endpoint

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

### 4. Trigger your first scrape

Either run the script directly:

```bash
npm run scrape
```

Or call the API endpoint:

```bash
curl -X POST "http://localhost:3000/api/scrape?key=YOUR_CRON_SECRET"
```

---

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/stats` | Current followers + daily/weekly/monthly growth |
| `GET`  | `/api/history?platform=instagram&range=30` | Historical data for charts |
| `POST` | `/api/scrape?key=CRON_SECRET` | Trigger follower scrape |

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

### 3. Cron job

The `vercel.json` file configures a daily cron job at **02:00 UTC** that calls `/api/scrape`. This requires a **Vercel Pro** plan or higher for cron jobs.

**Alternative (free):** Use [GitHub Actions](https://github.com/features/actions) or [cron-job.org](https://cron-job.org) to call the endpoint daily.

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
│   │   └── scrape/route.ts   # POST trigger scrape
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
├── .env.local.example
├── vercel.json               # Cron job config
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
