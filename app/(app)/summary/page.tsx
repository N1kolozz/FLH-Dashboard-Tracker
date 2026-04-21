import MonthlySummaryPageClient from "./MonthlySummaryPageClient";
import { getMonthlySummary } from "@/app/actions/monthly-summary";
import { getSession } from "@/lib/auth";

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MonthlySummaryPage() {
  const session = await getSession();
  const authorized = Boolean(session && (session.role === "ADMIN" || session.role === "HEAD"));
  const initialSelectedMonth = currentMonth();
  const result = authorized ? await getMonthlySummary(initialSelectedMonth) : null;

  return (
    <MonthlySummaryPageClient
      initialAuthorized={authorized}
      initialSelectedMonth={initialSelectedMonth}
      initialData={result && "success" in result ? result.data : null}
      initialError={result && "error" in result ? result.error : ""}
    />
  );
}
