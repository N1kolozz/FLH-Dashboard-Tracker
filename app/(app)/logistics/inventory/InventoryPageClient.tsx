"use client";

import { useState, useEffect } from "react";
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  checkoutItem,
  checkinItem,
} from "@/app/actions/inventory";
import type { InventoryItemRow, CheckoutRow } from "@/app/actions/inventory";
import Modal from "@/components/Modal";
import AppSelect from "@/components/ui/Select";
import EmptyState from "@/components/EmptyState";
import type { Session } from "@/lib/auth";
import { getStoredSkeletonCount, resolveSkeletonCount, setStoredSkeletonCount } from "@/lib/loading-skeleton";

/* ─── Types ─── */
type ItemStatus = "available" | "in_use" | "needs_repair" | "retired";
type Category = "electronics" | "furniture" | "supplies" | "clothing" | "transport" | "other";

interface InventoryItem {
  id: number;
  name: string;
  category: Category;
  quantity: number;
  status: ItemStatus;
  location: string;
  condition: string;
  notes: string;
  checkouts: CheckoutRow[];
  createdAt: string;
}

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
  id: 0,
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

function getItemPayload(item: InventoryItem) {
  return {
    name: item.name.trim(),
    category: item.category,
    quantity: item.quantity,
    status: item.status,
    location: item.location,
    condition: item.condition,
    notes: item.notes,
  };
}

function rowToItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Category,
    quantity: row.quantity,
    status: row.status as ItemStatus,
    location: row.location,
    condition: row.condition,
    notes: row.notes,
    checkouts: row.checkouts,
    createdAt: row.created_at,
  };
}

function sortItems(items: InventoryItem[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

const INVENTORY_SKELETON_STORAGE_KEY = "inventory-skeleton-count";

function InventoryGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-4 w-28 rounded-full bg-slate-200" />
              <div className="h-3 w-20 rounded-full bg-slate-100" />
            </div>
            <div className="h-5 w-16 rounded-full bg-slate-100" />
          </div>
          <div className="mb-3 flex gap-4">
            <div className="h-3 w-16 rounded-full bg-slate-100" />
            <div className="h-3 w-20 rounded-full bg-slate-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 flex-1 rounded-lg bg-slate-100" />
            <div className="h-8 flex-1 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function InventoryListSkeleton({ count }: { count: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: count }).map((_, idx) => (
            <tr key={idx} className="animate-pulse">
              <td className="px-4 py-3"><div className="h-4 w-24 rounded-full bg-slate-200" /></td>
              <td className="px-4 py-3"><div className="h-4 w-20 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3"><div className="h-4 w-10 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3"><div className="h-4 w-16 rounded-full bg-slate-100" /></td>
              <td className="px-4 py-3"><div className="h-6 w-24 rounded-md bg-slate-100" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InventoryPage({
  initialSession,
  initialItems,
}: {
  initialSession: Session | null;
  initialItems: InventoryItemRow[];
}) {
  const [items, setItems] = useState<InventoryItem[]>(sortItems(initialItems.map(rowToItem)));
  const [modalOpen, setModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem>(EMPTY);
  const [checkoutItemState, setCheckoutItemState] = useState<InventoryItem | null>(null);
  const [checkoutPerson, setCheckoutPerson] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ItemStatus | "all">("all");
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [session] = useState<Session | null>(initialSession);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [cachedItemCount, setCachedItemCount] = useState(0);

  useEffect(() => {
    setCachedItemCount(getStoredSkeletonCount(INVENTORY_SKELETON_STORAGE_KEY, 0));
  }, []);

  useEffect(() => {
    if (isLoadingData) return;

    setCachedItemCount(items.length);
    setStoredSkeletonCount(INVENTORY_SKELETON_STORAGE_KEY, items.length);
  }, [isLoadingData, items.length]);

  const canEdit = session && (
    session.role === "ADMIN" || 
    session.role === "HEAD" || 
    session.department === "Projects"
  );

  const refreshItems = async (showLoading = true) => {
    if (showLoading) setIsLoadingData(true);
    try {
      const res = await getInventoryItems();
      if (res.success && res.items) {
        setItems(sortItems(res.items.map(rowToItem)));
      }
    } finally {
      if (showLoading) setIsLoadingData(false);
    }
  };

  /* ─── CRUD ─── */
  const saveItem = async () => {
    const nextItem = {
      ...editing,
      name: editing.name.trim(),
    };

    if (!nextItem.name) return;

    if (nextItem.id) {
      const previousItem = items.find((item) => item.id === nextItem.id);

      setItems((current) =>
        sortItems(
          current.map((item) =>
            item.id === nextItem.id
              ? {
                  ...nextItem,
                  checkouts: previousItem?.checkouts ?? item.checkouts,
                  createdAt: previousItem?.createdAt ?? item.createdAt,
                }
              : item
          )
        )
      );

      const result = await updateInventoryItem(nextItem.id, getItemPayload(nextItem));

      if (!result.success) {
        if (previousItem) {
          setItems((current) =>
            sortItems(
              current.map((item) =>
                item.id === previousItem.id ? previousItem : item
              )
            )
          );
        }
        return;
      }
    } else {
      const result = await createInventoryItem(getItemPayload(nextItem));

      if (!result.success || typeof result.id !== "number") {
        return;
      }

      setItems((current) =>
        sortItems([
          {
            ...nextItem,
            id: result.id,
            checkouts: [],
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
    void refreshItems(false);
  };

  const handleDeleteItem = async (id: number) => {
    const deletedItem = items.find((item) => item.id === id);

    setItems((current) => current.filter((item) => item.id !== id));

    const result = await deleteInventoryItem(id);

    if (!result.success) {
      if (deletedItem) {
        setItems((current) => sortItems([deletedItem, ...current]));
      }
      return;
    }

    void refreshItems(false);
  };

  /* ─── Check-out / Check-in ─── */
  const openCheckout = (item: InventoryItem) => {
    setCheckoutItemState(item);
    setCheckoutPerson("");
    setCheckoutModalOpen(true);
  };

  const doCheckout = async () => {
    if (!checkoutItemState || !checkoutPerson.trim()) return;
    const person = checkoutPerson.trim();
    const result = await checkoutItem(checkoutItemState.id, person);

    if (!result.success) {
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === checkoutItemState.id
          ? {
              ...item,
              status: "in_use",
              checkouts: result.checkout
                ? [...item.checkouts, result.checkout]
                : item.checkouts,
            }
          : item
      )
    );

    setCheckoutModalOpen(false);
    setCheckoutItemState(null);
    setCheckoutPerson("");
    void refreshItems(false);
  };

  const doCheckin = async (item: InventoryItem) => {
    const result = await checkinItem(item.id);

    if (!result.success) {
      return;
    }

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              status: "available",
              checkouts: currentItem.checkouts.map((checkout) =>
                checkout.id === result.checkoutId
                  ? {
                      ...checkout,
                      return_date: result.returnDate || checkout.return_date,
                    }
                  : checkout
              ),
            }
          : currentItem
      )
    );

    void refreshItems(false);
  };

  /* ─── Filtering ─── */
  const filtered = items.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterCategory !== "all" && item.category !== filterCategory) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const inventorySkeletonCount = resolveSkeletonCount(items.length, cachedItemCount);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-purple-200/70 bg-emerald-100/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Inventory
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isLoadingData ? "Loading inventory..." : `${items.length} item${items.length !== 1 ? "s" : ""} tracked`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-300 sm:w-44"
            />
            <AppSelect
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as ItemStatus | "all")}
              options={[{ value: "all", label: "All statuses" }, ...(Object.keys(STATUS_CONFIG) as ItemStatus[]).map((s) => ({ value: s, label: STATUS_CONFIG[s].label }))]}
              className="sm:w-40"
            />
            <AppSelect
              value={filterCategory}
              onValueChange={(v) => setFilterCategory(v as Category | "all")}
              options={[{ value: "all", label: "All categories" }, ...(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))]}
              className="sm:w-44"
            />
            <div className="flex h-10 rounded-lg bg-slate-100 p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex-1 rounded-md px-3 text-xs font-medium transition-colors sm:flex-none ${viewMode === "grid" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}
              >Grid</button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex-1 rounded-md px-3 text-xs font-medium transition-colors sm:flex-none ${viewMode === "list" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}
              >List</button>
            </div>
            {canEdit && (
              <button
                onClick={() => { setEditing(EMPTY); setModalOpen(true); }}
                className="h-10 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 sm:w-auto"
              >
                + Add Item
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {isLoadingData ? (
          viewMode === "grid" ? (
            <InventoryGridSkeleton count={inventorySkeletonCount} />
          ) : (
            <InventoryListSkeleton count={inventorySkeletonCount} />
          )
        ) : items.length === 0 ? (
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
                  className="bg-white rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50"
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
                  {lastCheckout && !lastCheckout.return_date && (
                    <p className="text-xs text-amber-600 mb-3">
                      Checked out by <strong>{lastCheckout.person}</strong> on {lastCheckout.checkout_date}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditing(item); setModalOpen(true); }}
                      className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      {canEdit ? "Edit" : "View"}
                    </button>
                    {canEdit && item.status === "available" && (
                      <button
                        onClick={() => openCheckout(item)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        Check Out
                      </button>
                    )}
                    {canEdit && item.status === "in_use" && (
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
                            {canEdit ? "Edit" : "View"}
                          </button>
                          {canEdit && item.status === "available" && (
                            <button
                              onClick={() => openCheckout(item)}
                              className="px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            >
                              Check Out
                            </button>
                          )}
                          {canEdit && item.status === "in_use" && (
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
              className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
              placeholder="e.g., Projector"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <AppSelect
                value={editing.category}
                onValueChange={(v) => setEditing({ ...editing, category: v as Category })}
                options={(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min={0}
                value={editing.quantity}
                onChange={(e) => setEditing({ ...editing, quantity: parseInt(e.target.value) || 0 })}
                title="Quantity"
                className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <AppSelect
                value={editing.status}
                onValueChange={(v) => setEditing({ ...editing, status: v as ItemStatus })}
                options={(Object.keys(STATUS_CONFIG) as ItemStatus[]).map((s) => ({ value: s, label: STATUS_CONFIG[s].label }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input
                type="text"
                value={editing.location}
                onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                placeholder="e.g., Office A"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              disabled={!canEdit}
              value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              rows={2}
              className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 resize-none disabled:bg-slate-50"
              placeholder="Any additional notes..."
            />
          </div>
          {canEdit && (
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveItem}
                disabled={!editing.name.trim()}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {editing.id ? "Save Changes" : "Add Item"}
              </button>
              {editing.id ? (
                <button
                  onClick={() => { void handleDeleteItem(editing.id); setModalOpen(false); setEditing(EMPTY); }}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors"
                >
                  Delete
                </button>
              ) : null}
            </div>
          )}
        </div>
      </Modal>

      {/* Check-out Modal */}
      <Modal
        open={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        title={`Check Out: ${checkoutItemState?.name || ""}`}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Who is taking this item?</label>
            <input
              type="text"
              value={checkoutPerson}
              onChange={(e) => setCheckoutPerson(e.target.value)}
              className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
              placeholder="e.g., Ahmed"
            />
          </div>
          <button
            onClick={doCheckout}
            disabled={!checkoutPerson.trim()}
            className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Confirm Check Out
          </button>
        </div>
      </Modal>
    </div>
  );
}
