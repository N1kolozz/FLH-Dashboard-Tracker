import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type TimeRange = "30" | "90" | "all";

function getDateFilter(range: TimeRange): string {
  if (range === "30") return "AND fh.recorded_date >= CURRENT_DATE - INTERVAL '30 days'";
  if (range === "90") return "AND fh.recorded_date >= CURRENT_DATE - INTERVAL '90 days'";
  return "";
}

function csvEscape(value: string | number | null): string {
  if (value === null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  try {
    const rangeParam = request.nextUrl.searchParams.get("range") ?? "30";
    const range: TimeRange =
      rangeParam === "30" || rangeParam === "90" || rangeParam === "all"
        ? rangeParam
        : "30";

    const dateFilter = getDateFilter(range);

    const result = await pool.query<{
      date: string;
      platform: string;
      followers: number;
      total_likes: number | null;
      posts_count: number | null;
    }>(
      `
      SELECT
        TO_CHAR(fh.recorded_date, 'YYYY-MM-DD') AS date,
        sa.platform,
        fh.followers,
        fh.total_likes,
        fh.posts_count
      FROM follower_history fh
      JOIN social_accounts sa ON sa.id = fh.account_id
      WHERE 1=1
        ${dateFilter}
      ORDER BY fh.recorded_date ASC, sa.platform ASC
      `
    );

    const header = ["date", "platform", "followers", "total_likes", "posts_count"];
    const lines = [
      header.join(","),
      ...result.rows.map((row) =>
        [
          csvEscape(row.date),
          csvEscape(row.platform),
          csvEscape(row.followers),
          csvEscape(row.total_likes),
          csvEscape(row.posts_count),
        ].join(",")
      ),
    ];

    const csv = lines.join("\n");
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `flh-report-${range}-${timestamp}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("Report API error:", err);
    return NextResponse.json(
      { error: "Failed to generate report", details: String(err) },
      { status: 500 }
    );
  }
}
