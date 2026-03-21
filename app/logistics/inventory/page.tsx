"use client";

import { useState, useEffect } from "react";
import { loadStore, saveStore, generateId } from "@/lib/store";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";

/* ─── Types ─── */
type ItemStatus = "available" | "in_use" | "needs_repair" | "retired";
type Category = "electronics" | "furniture" | "supplies" | "clothing" | "transport" | "other";

interface CheckoutRecord {
  person: string;
  date: string;
  returnDate?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  status: ItemStatus;
  location: string;
  condition: string;
  notes: string;
  checkouts: CheckoutRecord[];
  createdAt: string;
}

const STORE_KEY = "flh_inventory";

const STATUS_CONFIG: Record<ItemStatus, { label: string; dot: string; classes: string }> = {
  available: { label: "Available", dot: "bg-emerald-500", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  in_use: { label: "In Use", dot: "bg-amber-500", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  needs_repair: { label: "Needs Repair", dot: "bg-rose-500", classes: "bg-rose-50 text-rose-700 border-rose-200" },
  retired: { label: "Retired", dot: "bg-slate-400", classes: "bg-slate-100 text-slate-500 border-slate-200" },
};

const CATEGORY_LABELS: Record<Category, string> = {
  electronics: "Electronics",
  furniture: "Furniture",
  supplies: "Supplies",
  clothing: "Clothing",
  transport: "Transport",
  other: "Other",
};

const EMPTY: InventoryItem = {
  id: "",
  name: "",
  category: "other",
  quantity: 1,
  status: "available",
  location: "",
  condition: "",
  notes: "",
  checkouts: [],
  createdAt: "",
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem>(EMPTY);
  const [checkoutItem, setCheckoutItem] = useState<InventoryItem | null>(null);
  const [checkoutPerson, setCheckoutPerson] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ItemStatus | "all">("all");
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    setItems(loadStore<InventoryItem>(STORE_KEY));
  }, []);

  const persist = (next: InventoryItem[]) => {
    setItems(next);
    saveStore(STORE_KEY, next);
  };

  /* ─── CRUD ─── */
  const saveItem = () => {
    if (!editing.name.trim()) return;
    let next: InventoryItem[];
    if (editing.id) {
      next = items.map((i) => (i.id === editing.id ? editing : i));
    } else {
      next = [...items, { ...editing, id: generateId(), createdAt: new Date().toISOString() }];
    }
    persist(next);
    setModalOpen(false);
    setEditing(EMPTY);
  };

  const deleteItem = (id: string) => {
    persist(items.filter((i) => i.id !== id));
  };

  /* ─── Check-out / Check-in ─── */
  const openCheckout = (item: InventoryItem) => {
    setCheckoutItem(item);
    setCheckoutPerson("");
    setCheckoutModalOpen(true);
  };

  const doCheckout = () => {
    if (!checkoutItem || !checkoutPerson.trim()) return;
    const record: CheckoutRecord = { person: checkoutPerson, date: new Date().toISOString().slice(0, 10) };
    const updated: InventoryItem = {
      ...checkoutItem,
      status: "in_use",
      checkouts: [...checkoutItem.checkouts, record],
    };
    persist(items.map((i) => (i.id === updated.id ? updated : i)));
    setCheckoutModalOpen(false);
  };

  const doCheckin = (item: InventoryItem) => {
    const checkouts = [...item.checkouts];
    if (checkouts.length > 0) {
      checkouts[checkouts.length - 1] = {
        ...checkouts[checkouts.length - 1],
        returnDate: new Date().toISOString().slice(0, 10),
      };
    }
    const updated: InventoryItem = { ...item, status: "available", checkouts };
    persist(items.map((i) => (i.id === updated.id ? updated : i)));
  };

  /* ─── Filtering ─── */
  const filtered = items.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterCategory !== "all" && item.category !== filterCategory) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const lowStockItems = items.filter((i) => i.status === "available" && i.quantity <= 2 && i.quantity > 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-purple-200/70 bg-gradient-to-r from-blue-50/70 via-cyan-50/65 to-sky-50/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Inventory</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""} tracked
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-40"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ItemStatus | "all")}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">All statuses</option>
              {(Object.keys(STATUS_CONFIG) as ItemStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as Category | "all")}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">All categories</option>
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}
              >Grid</button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}
              >List</button>
            </div>
            <button
              onClick={() => { setEditing(EMPTY); setModalOpen(true); }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              + Add Item
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Low-stock alerts */}
        {lowStockItems.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-700 mb-1">⚠️ Low Stock Alert</p>
            <p className="text-sm text-amber-600">
              {lowStockItems.map((i) => `${i.name} (${i.quantity} left)`).join(" · ")}
            </p>
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState
            title="No inventory items"
            description="Start tracking your NGO's assets, equipment, and supplies."
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            action={{ label: "Add First Item", onClick: () => { setEditing(EMPTY); setModalOpen(true); } }}
          />
        ) : viewMode === "grid" ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const sc = STATUS_CONFIG[item.status];
              const lastCheckout = item.checkouts[item.checkouts.length - 1];
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all duration-150 hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">{item.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{CATEGORY_LABELS[item.category]}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.classes}`}>
                      {sc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                    <span>Qty: <strong className="text-slate-700">{item.quantity}</strong></span>
                    {item.location && <span>📍 {item.location}</span>}
                  </div>
                  {lastCheckout && !lastCheckout.returnDate && (
                    <p className="text-xs text-amber-600 mb-3">
                      Checked out by <strong>{lastCheckout.person}</strong> on {lastCheckout.date}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditing(item); setModalOpen(true); }}
                      className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    {item.status === "available" && (
                      <button
                        onClick={() => openCheckout(item)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        Check Out
                      </button>
                    )}
                    {item.status === "in_use" && (
                      <button
                        onClick={() => doCheckin(item)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        Check In
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                  const sc = STATUS_CONFIG[item.status];
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                      <td className="px-4 py-3 text-slate-500">{CATEGORY_LABELS[item.category]}</td>
                      <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.classes}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{item.location || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditing(item); setModalOpen(true); }}
                            className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded transition-colors"
                          >
                            Edit
                          </button>
                          {item.status === "available" && (
                            <button
                              onClick={() => openCheckout(item)}
                              className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              Check Out
                            </button>
                          )}
                          {item.status === "in_use" && (
                            <button
                              onClick={() => doCheckin(item)}
                              className="px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            >
                              Check In
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(EMPTY); }}
        title={editing.id ? "Edit Item" : "Add Inventory Item"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              placeholder="e.g., Projector"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value as Category })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min={0}
                value={editing.quantity}
                onChange={(e) => setEditing({ ...editing, quantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as ItemStatus })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {(Object.keys(STATUS_CONFIG) as ItemStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input
                type="text"
                value={editing.location}
                onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="e.g., Office A"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              placeholder="Any additional notes..."
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={saveItem}
              disabled={!editing.name.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {editing.id ? "Save Changes" : "Add Item"}
            </button>
            {editing.id && (
              <button
                onClick={() => { deleteItem(editing.id); setModalOpen(false); setEditing(EMPTY); }}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Check-out Modal */}
      <Modal
        open={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        title={`Check Out: ${checkoutItem?.name || ""}`}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Who is taking this item?</label>
            <input
              type="text"
              value={checkoutPerson}
              onChange={(e) => setCheckoutPerson(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="e.g., Ahmed"
            />
          </div>
          <button
            onClick={doCheckout}
            disabled={!checkoutPerson.trim()}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Confirm Check Out
          </button>
        </div>
      </Modal>
    </div>
  );
}
