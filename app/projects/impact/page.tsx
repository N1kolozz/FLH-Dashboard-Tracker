"use client";

import { useState, useEffect, useMemo } from "react";
import { loadStore, saveStore, generateId } from "@/lib/store";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";

/* ─── Types ─── */
type ActivityType = "workshop" | "training" | "outreach" | "mentoring" | "event" | "other";

interface ImpactRecord {
  id: string;
  projectName: string;
  activityType: ActivityType;
  peopleReached: number;
  date: string;
  notes: string;
  createdAt: string;
}

const STORE_KEY = "flh_impact";

const ACTIVITY_CONFIG: Record<ActivityType, { label: string; color: string }> = {
  workshop: { label: "Workshop", color: "bg-purple-100 text-purple-700" },
  training: { label: "Training", color: "bg-blue-100 text-blue-700" },
  outreach: { label: "Outreach", color: "bg-emerald-100 text-emerald-700" },
  mentoring: { label: "Mentoring", color: "bg-amber-100 text-amber-700" },
  event: { label: "Event", color: "bg-rose-100 text-rose-700" },
  other: { label: "Other", color: "bg-slate-100 text-slate-600" },
};

const EMPTY: ImpactRecord = { id: "", projectName: "", activityType: "other", peopleReached: 0, date: "", notes: "", createdAt: "" };

export default function ImpactPage() {
  const [records, setRecords] = useState<ImpactRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ImpactRecord>(EMPTY);

  useEffect(() => { setRecords(loadStore<ImpactRecord>(STORE_KEY)); }, []);
  const persist = (next: ImpactRecord[]) => { setRecords(next); saveStore(STORE_KEY, next); };

  const saveRecord = () => {
    if (!editing.projectName.trim() || !editing.date || editing.peopleReached <= 0) return;
    let next: ImpactRecord[];
    if (editing.id) {
      next = records.map((r) => (r.id === editing.id ? editing : r));
    } else {
      next = [...records, { ...editing, id: generateId(), createdAt: new Date().toISOString() }];
    }
    persist(next);
    setModalOpen(false);
    setEditing(EMPTY);
  };

  const deleteRecord = (id: string) => { persist(records.filter((r) => r.id !== id)); };

  const totalPeople = records.reduce((s, r) => s + r.peopleReached, 0);
  const totalActivities = records.length;

  // Group by project
  const byProject = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach((r) => {
      map[r.projectName] = (map[r.projectName] || 0) + r.peopleReached;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const maxProjectImpact = Math.max(...byProject.map(([, v]) => v), 1);

  // Cumulative timeline data
  const cumulativeData = useMemo(() => {
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    let cumulative = 0;
    return sorted.map((r) => {
      cumulative += r.peopleReached;
      return { date: r.date, total: cumulative, label: r.projectName };
    });
  }, [records]);

  const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-purple-200/70 bg-gradient-to-r from-emerald-50/70 via-teal-50/65 to-cyan-50/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Impact Tracker</h1>
            <p className="text-xs text-slate-500 mt-0.5">Track beneficiaries and measure project impact</p>
          </div>
          <button
            onClick={() => { setEditing({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModalOpen(true); }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >+ Add Record</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-emerald-600">{totalPeople.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1 uppercase font-semibold">People Reached</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-slate-900">{totalActivities}</p>
            <p className="text-xs text-slate-500 mt-1 uppercase font-semibold">Activities</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-purple-600">{byProject.length}</p>
            <p className="text-xs text-slate-500 mt-1 uppercase font-semibold">Projects</p>
          </div>
        </div>

        {/* Impact by project */}
        {byProject.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-4">Impact by Project</h3>
            <div className="space-y-3">
              {byProject.map(([name, total]) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700 font-medium">{name}</span>
                    <span className="text-sm text-slate-900 font-semibold">{total.toLocaleString()} people</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${(total / maxProjectImpact) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cumulative timeline */}
        {cumulativeData.length > 1 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-4">Cumulative Reach Over Time</h3>
            <div className="flex items-end gap-1 h-32">
              {cumulativeData.map((point, idx) => {
                const height = (point.total / cumulativeData[cumulativeData.length - 1].total) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div className="absolute -top-6 hidden group-hover:block bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                      {point.date}: {point.total.toLocaleString()} total
                    </div>
                    <div
                      className="w-full bg-emerald-400 rounded-t-sm transition-all duration-300 hover:bg-emerald-500 min-h-[4px]"
                      style={{ height: `${Math.max(height, 3)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-slate-400">{cumulativeData[0]?.date}</span>
              <span className="text-[10px] text-slate-400">{cumulativeData[cumulativeData.length - 1]?.date}</span>
            </div>
          </div>
        )}

        {/* Records list */}
        {records.length === 0 ? (
          <EmptyState
            title="No impact records yet"
            description="Start tracking beneficiaries to measure your NGO's real-world impact."
            icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            action={{ label: "Add Impact Record", onClick: () => { setEditing({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModalOpen(true); } }}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3 text-right">People Reached</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.projectName}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ACTIVITY_CONFIG[r.activityType].color}`}>{ACTIVITY_CONFIG[r.activityType].label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{r.peopleReached.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setEditing(r); setModalOpen(true); }} className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded transition-colors">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(EMPTY); }} title={editing.id ? "Edit Record" : "Add Impact Record"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
            <input type="text" value={editing.projectName} onChange={(e) => setEditing({ ...editing, projectName: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="e.g., Youth Leadership Program" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">People Reached *</label>
              <input type="number" min={1} value={editing.peopleReached || ""} onChange={(e) => setEditing({ ...editing, peopleReached: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" placeholder="50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Activity Type</label>
              <select value={editing.activityType} onChange={(e) => setEditing({ ...editing, activityType: e.target.value as ActivityType })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
                {(Object.keys(ACTIVITY_CONFIG) as ActivityType[]).map((a) => (<option key={a} value={a}>{ACTIVITY_CONFIG[a].label}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" placeholder="Details about the activity..." />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={saveRecord} disabled={!editing.projectName.trim() || !editing.date || editing.peopleReached <= 0} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors">{editing.id ? "Save Changes" : "Add Record"}</button>
            {editing.id && (
              <button onClick={() => { deleteRecord(editing.id); setModalOpen(false); setEditing(EMPTY); }} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors">Delete</button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
