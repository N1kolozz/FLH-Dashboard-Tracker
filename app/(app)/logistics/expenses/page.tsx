import ExpensesPageClient from "./ExpensesPageClient";
import { getExpenses } from "@/app/actions/expenses";
import { getSession } from "@/lib/auth";

export default async function ExpensesPage() {
  const [session, expensesResult] = await Promise.all([getSession(), getExpenses()]);

  return (
    <ExpensesPageClient
      initialSession={session}
      initialExpenses={
        "success" in expensesResult && expensesResult.expenses
          ? expensesResult.expenses
          : []
      }
    />
  );
}
