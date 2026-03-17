import { NextRequest, NextResponse } from "next/server";

// Scraping no longer runs here (Playwright/Chromium not available on Vercel).
// It runs in GitHub Actions. This endpoint can trigger that workflow if configured.

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = process.env.GITHUB_REPO; // e.g. "owner/repo"
  const token = process.env.GITHUB_ACTIONS_TOKEN;

  if (repo && token) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/scrape.yml/dispatches`,
        {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
          ref: process.env.GITHUB_REF || "main",
        }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        console.error("GitHub Actions trigger failed:", res.status, text);
        return NextResponse.json(
          { error: "Failed to trigger workflow", details: text },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Scrape workflow triggered in GitHub Actions",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Scrape API error:", err);
      return NextResponse.json(
        { error: "Trigger failed", details: String(err) },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    message:
      "Scraping runs via GitHub Actions (schedule or manual run). Set GITHUB_REPO and GITHUB_ACTIONS_TOKEN to trigger from this URL.",
    timestamp: new Date().toISOString(),
  });
}
