"use client";

import { useState, useEffect, useMemo } from "react";
import { getExpenses, createExpense, updateExpense, deleteExpense } from "@/app/actions/expenses";
import type { ExpenseRow } from "@/app/actions/expenses";
import Modal from "@/components/Modal";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import AppSelect from "@/components/ui/Select";
import EmptyState from "@/components/EmptyState";
import type { Session } from "@/lib/auth";
import { getStoredSkeletonCount, resolveSkeletonCount, setStoredSkeletonCount } from "@/lib/loading-skeleton";

/* ─── Types ─── */
type ExpenseCategory = "supplies" | "transport" | "food" | "venue" | "printing" | "equipment" | "communication" | "other";

interface Expense {
  id: number;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  paidBy: string;
  notes: string;
  createdAt: string;
}

const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; color: string }> = {
  supplies: { label: "Supplies", color: "bg-blue-100 text-blue-700" },
  transport: { label: "Transport", color: "bg-amber-100 text-amber-700" },
  food: { label: "Food & Drinks", color: "bg-orange-100 text-orange-700" },
  venue: { label: "Venue Rental", color: "bg-purple-100 text-purple-700" },
  printing: { label: "Printing", color: "bg-cyan-100 text-cyan-700" },
  equipment: { label: "Equipment", color: "bg-emerald-100 text-emerald-700" },
  communication: { label: "Communication", color: "bg-pink-100 text-pink-700" },
  other: { label: "Other", color: "bg-slate-100 text-slate-600" },
};

const BAR_COLORS = [
  "bg-emerald-500", "bg-amber-500", "bg-orange-500", "bg-purple-500",
  "bg-cyan-500", "bg-emerald-500", "bg-pink-500", "bg-slate-400",
];

const EMPTY: Expense = { id: 0, description: "", amount: 0, category: "other", date: "", paidBy: "", notes: "", createdAt: "" };
const EXPENSE_TABLE_SKELETON_STORAGE_KEY = "expenses-table-skeleton-count";
const EXPENSE_CHART_SKELETON_STORAGE_KEY = "expenses-chart-skeleton-count";

function getExpensePayload(expense: Expense) {
  return {
    description: expense.description.trim(),
    amount: expense.amount,
    category: expense.category,
    date: expense.date,
    paidBy: expense.paidBy,
    notes: expense.notes,
  };
}

function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    description: row.description,
    amount: row.amount,
    category: row.category as ExpenseCategory,
    date: row.date,
    paidBy: row.paid_by,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function sortExpenses(items: Expense[]) {
  return [...items].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function ExpenseSummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="animate-pulse rounded-xl border border-slate-100 bg-white p-5 text-center shadow-sm">
          <div className="mx-auto h-8 w-28 rounded-2xl bg-slate-200" />
          <div className="mx-auto mt-2 h-3 w-24 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function ExpenseChartSkeleton({ count }: { count: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 h-4 w-40 animate-pulse rounded-full bg-slate-200" />
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="animate-pulse">
            <div className="mb-1 flex items-center justify-between">
              <div className="h-4 w-24 rounded-full bg-slate-100" />
              <div className="h-4 w-16 rounded-full bg-slate-100" />
            </div>
            <div className="h-2.5 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpenseTableSkeleton({ count }: { count: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Paid By</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: count }).map((_, idx) => (
            <tr key={idx} className="animate-pulse">
              <td className="px-4 py-3"><div className="h-4 w-20 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3"><div className="h-4 w-36 rounded-full bg-slate-200" /></td>
              <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3"><div className="h-4 w-20 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3 text-right"><div className="ml-auto h-4 w-16 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3"><div className="h-6 w-12 rounded-md bg-slate-100" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ExpensesPage({
  initialSession,
  initialExpenses,
}: {
  initialSession: Session | null;
  initialExpenses: ExpenseRow[];
}) {
  const [expenses, setExpenses] = useState<Expense[]>(sortExpenses(initialExpenses.map(rowToExpense)));
  const [modalOpen, setModalOpen] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDialog } = useConfirmDialog();
  const [editing, setEditing] = useState<Expense>(EMPTY);
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">("all");
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [session] = useState<Session | null>(initialSession);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [cachedExpenseCount, setCachedExpenseCount] = useState(0);
  const [cachedCategoryCount, setCachedCategoryCount] = useState(0);

  useEffect(() => {
    setCachedExpenseCount(getStoredSkeletonCount(EXPENSE_TABLE_SKELETON_STORAGE_KEY, 0));
    setCachedCategoryCount(getStoredSkeletonCount(EXPENSE_CHART_SKELETON_STORAGE_KEY, 0));
  }, []);

  const refreshExpenses = async (showLoading = true) => {
    if (showLoading) setIsLoadingData(true);
    try {
      const res = await getExpenses();
      if (res.success && res.expenses) {
        setExpenses(sortExpenses(res.expenses.map(rowToExpense)));
      }
    } finally {
      if (showLoading) setIsLoadingData(false);
    }
  };

  const canEdit = session && (
    session.role === "ADMIN" || 
    session.role === "HEAD" || 
    session.department === "Projects"
  );

  const saveExpenseHandler = async () => {
    const nextExpense = {
      ...editing,
      description: editing.description.trim(),
    };

    if (!nextExpense.description || !nextExpense.date || nextExpense.amount <= 0) return;

    if (nextExpense.id) {
      const previousExpense = expenses.find((expense) => expense.id === nextExpense.id);

      setExpenses((current) =>
        sortExpenses(
          current.map((expense) =>
            expense.id === nextExpense.id
              ? {
                  ...nextExpense,
                  createdAt: previousExpense?.createdAt ?? expense.createdAt,
                }
              : expense
          )
        )
      );

      const result = await updateExpense(nextExpense.id, getExpensePayload(nextExpense));

      if (!result.success) {
        if (previousExpense) {
          setExpenses((current) =>
            sortExpenses(
              current.map((expense) =>
                expense.id === previousExpense.id ? previousExpense : expense
              )
            )
          );
        }
        return;
      }
    } else {
      const result = await createExpense(getExpensePayload(nextExpense));

      if (!result.success || typeof result.id !== "number") {
        return;
      }

      setExpenses((current) =>
        sortExpenses([
          {
            ...nextExpense,
            id: result.id,
            createdAt:
              typeof result.createdAt === "string" && result.createdAt
                ? result.createdAt
                : new Date().toISOString(),
          },
          ...current,
        ])
      );
    }

    setModalOpen(false);
    setEditing(EMPTY);
    void refreshExpenses(false);
  };

  const handleDeleteExpense = async (id: number) => {
    const deletedExpense = expenses.find((expense) => expense.id === id);
    const ok = await confirmDelete({
      title: "Delete expense?",
      message: deletedExpense
        ? `Are you sure you want to delete "${deletedExpense.description}"? This cannot be undone.`
        : "Are you sure you want to delete this expense? This cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    setExpenses((current) => current.filter((expense) => expense.id !== id));

    const result = await deleteExpense(id);

    if (!result.success) {
      if (deletedExpense) {
        setExpenses((current) => sortExpenses([deletedExpense, ...current]));
      }
      return;
    }

    void refreshExpenses(false);
  };

  const filtered = expenses
    .filter((e) => e.date.startsWith(filterMonth))
    .filter((e) => filterCategory === "all" || e.category === filterCategory)
    .sort((a, b) => b.date.localeCompare(a.date));

  const monthTotal = filtered.reduce((sum, e) => sum + e.amount, 0);

  // Category breakdown for mini chart
  const categoryBreakdown = useMemo(() => {
    const cats = Object.keys(CATEGORY_CONFIG) as ExpenseCategory[];
    const data = cats.map((c) => ({
      category: c,
      label: CATEGORY_CONFIG[c].label,
      total: filtered.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0),
    })).filter((d) => d.total > 0).sort((a, b) => b.total - a.total);
    return data;
  }, [filtered]);

  const maxCategoryTotal = Math.max(...categoryBreakdown.map((d) => d.total), 1);
  const expenseSkeletonCount = resolveSkeletonCount(filtered.length, cachedExpenseCount);
  const categorySkeletonCount = resolveSkeletonCount(
    categoryBreakdown.length,
    cachedCategoryCount
  );

  // Month navigation
  const prevMonth = () => {
    const d = new Date(filterMonth + "-01");
    d.setMonth(d.getMonth() - 1);
    setFilterMonth(d.toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const d = new Date(filterMonth + "-01");
    d.setMonth(d.getMonth() + 1);
    setFilterMonth(d.toISOString().slice(0, 7));
  };

  const monthLabel = new Date(filterMonth + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" });

  useEffect(() => {
    if (isLoadingData) return;

    setCachedExpenseCount(filtered.length);
    setStoredSkeletonCount(EXPENSE_TABLE_SKELETON_STORAGE_KEY, filtered.length);
    setCachedCategoryCount(categoryBreakdown.length);
    setStoredSkeletonCount(EXPENSE_CHART_SKELETON_STORAGE_KEY, categoryBreakdown.length);
  }, [categoryBreakdown.length, filtered.length, isLoadingData]);

  return (
    <>
    {confirmDialog}
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-purple-200/70 bg-emerald-100/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Expense Tracker
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isLoadingData ? "Loading expenses..." : `${expenses.length} total record${expenses.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => { setEditing({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModalOpen(true); }}
              className="h-10 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 sm:w-auto"
            >+ Add Expense</button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Month Nav + Summary */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">← Prev</button>
          <h2 className="text-lg font-semibold text-slate-800">{monthLabel}</h2>
          <button onClick={nextMonth} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Next →</button>
        </div>

        {isLoadingData ? (
          <ExpenseSummarySkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
              <p className="text-3xl font-bold text-slate-900">₾{monthTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-slate-500 mt-1 uppercase font-semibold">Total This Month</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
              <p className="text-3xl font-bold text-slate-900">{filtered.length}</p>
              <p className="text-xs text-slate-500 mt-1 uppercase font-semibold">Transactions</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
              <p className="text-3xl font-bold text-slate-900">{categoryBreakdown.length}</p>
              <p className="text-xs text-slate-500 mt-1 uppercase font-semibold">Categories</p>
            </div>
          </div>
        )}

        {/* Breakdown chart */}
        {isLoadingData ? (
          <ExpenseChartSkeleton count={categorySkeletonCount} />
        ) : categoryBreakdown.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-4">Spending by Category</h3>
            <div className="space-y-3">
              {categoryBreakdown.map((item, idx) => (
                <div key={item.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700 font-medium">{item.label}</span>
                    <span className="text-sm text-slate-900 font-semibold">₾{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${BAR_COLORS[idx % BAR_COLORS.length]} transition-all duration-500`}
                      style={{ width: `${(item.total / maxCategoryTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter + List */}
        <div className="flex items-center gap-2 flex-wrap">
          <AppSelect
            value={filterCategory}
            onValueChange={(v) => setFilterCategory(v as ExpenseCategory | "all")}
            options={[
              { value: "all", label: "All categories" },
              ...(Object.keys(CATEGORY_CONFIG) as ExpenseCategory[]).map((c) => ({ value: c, label: CATEGORY_CONFIG[c].label })),
            ]}
            className="w-auto"
          />
        </div>

        {isLoadingData ? (
          <ExpenseTableSkeleton count={expenseSkeletonCount} />
        ) : expenses.length === 0 ? (
          <EmptyState
            title="No expenses recorded"
            description="Start tracking your NGO's spending for full accountability."
            icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            action={canEdit ? { label: "Add Expense", onClick: () => { setEditing({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModalOpen(true); } } : undefined}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Paid By</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{exp.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{exp.description}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_CONFIG[exp.category].color}`}>{CATEGORY_CONFIG[exp.category].label}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{exp.paidBy || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">₾{exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setEditing(exp); setModalOpen(true); }} className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded transition-colors">{canEdit ? "Edit" : "View"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(EMPTY); }} title={editing.id ? (canEdit ? "Edit Expense" : "View Expense") : "Add Expense"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <input disabled={!canEdit} type="text" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50" placeholder="e.g., Banners for Youth Event" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₾) *</label>
              <input disabled={!canEdit} type="number" min={0} step={0.01} value={editing.amount || ""} onChange={(e) => setEditing({ ...editing, amount: parseFloat(e.target.value) || 0 })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input disabled={!canEdit}
                type="date"
                value={editing.date}
                onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                title="Date"
                className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <AppSelect
                value={editing.category}
                onValueChange={(v) => setEditing({ ...editing, category: v as ExpenseCategory })}
                disabled={!canEdit}
                options={(Object.keys(CATEGORY_CONFIG) as ExpenseCategory[]).map((c) => ({ value: c, label: CATEGORY_CONFIG[c].label }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Paid By</label>
              <input disabled={!canEdit} type="text" value={editing.paidBy} onChange={(e) => setEditing({ ...editing, paidBy: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50" placeholder="e.g., Ahmed" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea disabled={!canEdit} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 resize-none disabled:bg-slate-50" placeholder="Any notes..." />
          </div>
          {canEdit && (
            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveExpenseHandler} disabled={!editing.description.trim() || !editing.date || editing.amount <= 0} className="flex-1  px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors">{editing.id ? "Save Changes" : "Add Expense"}</button>
              {editing.id ? (
                <button
                  onClick={async () => {
                    const targetId = editing.id;
                    await handleDeleteExpense(targetId);
                    setModalOpen(false);
                    setEditing(EMPTY);
                  }}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors"
                >
                  Delete
                </button>
              ) : null}
            </div>
          )}
        </div>
      </Modal>
    </div>
    </>
  );
}
