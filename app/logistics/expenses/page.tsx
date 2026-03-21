"use client";

import { useState, useEffect, useMemo } from "react";
import { loadStore, saveStore, generateId } from "@/lib/store";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";

/* ─── Types ─── */
type ExpenseCategory = "supplies" | "transport" | "food" | "venue" | "printing" | "equipment" | "communication" | "other";

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  paidBy: string;
  notes: string;
  createdAt: string;
}

const STORE_KEY = "flh_expenses";

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
  "bg-blue-500", "bg-amber-500", "bg-orange-500", "bg-purple-500",
  "bg-cyan-500", "bg-emerald-500", "bg-pink-500", "bg-slate-400",
];

const EMPTY: Expense = { id: "", description: "", amount: 0, category: "other", date: "", paidBy: "", notes: "", createdAt: "" };

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense>(EMPTY);
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">("all");
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => { setExpenses(loadStore<Expense>(STORE_KEY)); }, []);
  const persist = (next: Expense[]) => { setExpenses(next); saveStore(STORE_KEY, next); };

  const saveExpense = () => {
    if (!editing.description.trim() || !editing.date || editing.amount <= 0) return;
    let next: Expense[];
    if (editing.id) {
      next = expenses.map((e) => (e.id === editing.id ? editing : e));
    } else {
      next = [...expenses, { ...editing, id: generateId(), createdAt: new Date().toISOString() }];
    }
    persist(next);
    setModalOpen(false);
    setEditing(EMPTY);
  };

  const deleteExpense = (id: string) => { persist(expenses.filter((e) => e.id !== id)); };

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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-purple-200/70 bg-gradient-to-r from-emerald-50/70 via-teal-50/65 to-cyan-50/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Expense Tracker</h1>
            <p className="text-xs text-slate-500 mt-0.5">{expenses.length} total record{expenses.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => { setEditing({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModalOpen(true); }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >+ Add Expense</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Month Nav + Summary */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">← Prev</button>
          <h2 className="text-lg font-semibold text-slate-800">{monthLabel}</h2>
          <button onClick={nextMonth} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Next →</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total this month */}
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

        {/* Breakdown chart */}
        {categoryBreakdown.length > 0 && (
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
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | "all")}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <option value="all">All categories</option>
            {(Object.keys(CATEGORY_CONFIG) as ExpenseCategory[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
            ))}
          </select>
        </div>

        {expenses.length === 0 ? (
          <EmptyState
            title="No expenses recorded"
            description="Start tracking your NGO's spending for full accountability."
            icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            action={{ label: "Add Expense", onClick: () => { setEditing({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModalOpen(true); } }}
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
                      <button onClick={() => { setEditing(exp); setModalOpen(true); }} className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded transition-colors">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(EMPTY); }} title={editing.id ? "Edit Expense" : "Add Expense"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <input type="text" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g., Banners for Youth Event" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₾) *</label>
              <input type="number" min={0} step={0.01} value={editing.amount || ""} onChange={(e) => setEditing({ ...editing, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as ExpenseCategory })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
                {(Object.keys(CATEGORY_CONFIG) as ExpenseCategory[]).map((c) => (<option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Paid By</label>
              <input type="text" value={editing.paidBy} onChange={(e) => setEditing({ ...editing, paidBy: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g., Ahmed" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" placeholder="Any notes..." />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={saveExpense} disabled={!editing.description.trim() || !editing.date || editing.amount <= 0} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors">{editing.id ? "Save Changes" : "Add Expense"}</button>
            {editing.id && (
              <button onClick={() => { deleteExpense(editing.id); setModalOpen(false); setEditing(EMPTY); }} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors">Delete</button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
