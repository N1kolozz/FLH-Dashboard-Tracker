# Meta Graph API + scrape job walkthrough

This project records daily follower metrics for Instagram, Facebook, and TikTok. Instagram and Facebook use the **Meta Graph API**; TikTok uses **Playwright** in [scripts/scrapeFollowers.ts](scripts/scrapeFollowers.ts).

## Prerequisites (Meta)

1. Create a Meta app at [developers.facebook.com](https://developers.facebook.com/).
2. Link a **Professional/Business** Instagram account to a **Facebook Page**.
3. Generate a **long-lived Page access token** with:
   - `pages_read_engagement`
   - `pages_show_list`
   - `instagram_basic`
4. Note the **Facebook Page ID** and the **Instagram Business Account ID** (Graph API identifiers, not the `@username`).

Use the [Graph API Explorer](https://developers.facebook.com/tools/explorer/) to test:

- `GET /{page-id}?fields=followers_count,fan_count`
- `GET /{ig-user-id}?fields=followers_count,media_count`

## Environment variables

Add to `.env.local` (local runs) and to **GitHub Actions → Secrets** (CI):

| Variable | Purpose |
|----------|---------|
| `META_ACCESS_TOKEN` | Page access token for Graph API |
| `FB_PAGE_ID` | Facebook Page node ID |
| `IG_ACCOUNT_ID` | Instagram Business Account node ID |

Also required for saving data: `DATABASE_URL`, and optionally `APP_TIMEZONE`.

See [.env.local.example](.env.local.example) for placeholders.

## Running the scrape locally

```bash
npm run scrape
```

The script:

1. Calls Graph API for Instagram (`followers_count`, `media_count`) and Facebook (`followers_count`, `fan_count` → stored as page likes).
2. Launches Chromium once and scrapes the configured TikTok profile.
3. Writes rows into `follower_history` (carry-forward rules apply if a platform returns no follower count; see script comments).

## GitHub Actions

Workflow: [.github/workflows/scrape.yml](.github/workflows/scrape.yml). It must receive the same Meta secrets as above plus `DATABASE_URL`. After changing secrets, use **Actions → Scrape followers → Run workflow** to verify.

## Versioning

Graph API version is pinned in code as `v19.0`. If Meta deprecates fields (e.g. `fan_count`), update the version constant and field list in `scrapeFollowers.ts` to match [current Page / IG User reference](https://developers.facebook.com/docs/graph-api/reference/).
