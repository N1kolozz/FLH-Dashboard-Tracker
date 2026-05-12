import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

type TimeRange = "30" | "90" | "all";

function getDateFilter(range: TimeRange, tzParamIndex: number): string {
  if (range === "30") {
    return `AND fh.recorded_date >= timezone($${tzParamIndex}, now())::date - 30`;
  }
  if (range === "90") {
    return `AND fh.recorded_date >= timezone($${tzParamIndex}, now())::date - 90`;
  }
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
    const appTimeZone = process.env.APP_TIMEZONE || "UTC";
    const rangeParam = request.nextUrl.searchParams.get("range") ?? "30";
    const range: TimeRange =
      rangeParam === "30" || rangeParam === "90" || rangeParam === "all"
        ? rangeParam
        : "30";

    const queryParams: string[] = [];
    if (range !== "all") {
      queryParams.push(appTimeZone);
    }
    const dateFilter = getDateFilter(range, queryParams.length);

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
      `,
      queryParams
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
    const fileName = `flhub-report-${range}-${timestamp}.csv`;

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
