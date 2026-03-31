"use client";

import { useState, useEffect, useMemo } from "react";
import { getImpactRecords, createImpactRecord, updateImpactRecord, deleteImpactRecord } from "@/app/actions/impact";
import type { ImpactRecordRow } from "@/app/actions/impact";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { getCurrentSession } from "@/app/actions/session";
import type { Session } from "@/lib/auth";

/* ─── Types ─── */
type ActivityType = "workshop" | "training" | "outreach" | "mentoring" | "event" | "other";

interface ImpactRecord {
  id: number;
  projectName: string;
  activityType: ActivityType;
  peopleReached: number;
  date: string;
  notes: string;
  createdAt: string;
}

const ACTIVITY_CONFIG: Record<ActivityType, { label: string; color: string }> = {
  workshop: { label: "Workshop", color: "bg-purple-100 text-purple-700" },
  training: { label: "Training", color: "bg-blue-100 text-blue-700" },
  outreach: { label: "Outreach", color: "bg-blue-100 text-blue-700" },
  mentoring: { label: "Mentoring", color: "bg-amber-100 text-amber-700" },
  event: { label: "Event", color: "bg-rose-100 text-rose-700" },
  other: { label: "Other", color: "bg-slate-100 text-slate-600" },
};

const EMPTY: ImpactRecord = { id: 0, projectName: "", activityType: "other", peopleReached: 0, date: "", notes: "", createdAt: "" };

function rowToRecord(row: ImpactRecordRow): ImpactRecord {
  return {
    id: row.id,
    projectName: row.project_name,
    activityType: row.activity_type as ActivityType,
    peopleReached: row.people_reached,
    date: row.date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export default function ImpactPage() {
  const [records, setRecords] = useState<ImpactRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ImpactRecord>(EMPTY);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    async function init() {
      const sess = await getCurrentSession();
      setSession(sess);
      await refreshRecords();
    }
    init();
  }, []);

  const canEdit = session && (
    session.role === "ADMIN" || 
    session.role === "HEAD" || 
    session.department === "Projects"
  );

  const refreshRecords = async () => {
    const res = await getImpactRecords();
    if (res.success && res.records) {
      setRecords(res.records.map(rowToRecord));
    }
  };

  const saveRecord = async () => {
    if (!editing.projectName.trim() || !editing.date || editing.peopleReached <= 0) return;
    if (editing.id) {
      await updateImpactRecord(editing.id, {
        projectName: editing.projectName,
        activityType: editing.activityType,
        peopleReached: editing.peopleReached,
        date: editing.date,
        notes: editing.notes,
      });
    } else {
      await createImpactRecord({
        projectName: editing.projectName,
        activityType: editing.activityType,
        peopleReached: editing.peopleReached,
        date: editing.date,
        notes: editing.notes,
      });
    }
    await refreshRecords();
    setModalOpen(false);
    setEditing(EMPTY);
  };

  const handleDeleteRecord = async (id: number) => {
    await deleteImpactRecord(id);
    await refreshRecords();
  };

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
      <header className="border-b border-purple-200/70 bg-blue-100/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Impact Tracker
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Track beneficiaries and measure project impact</p>
          </div>
          {canEdit && (
            <button
              onClick={() => { setEditing({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModalOpen(true); }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >+ Add Record</button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-blue-600">{totalPeople.toLocaleString()}</p>
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
                      className="h-2.5 rounded-full bg-blue-500 transition-all duration-500"
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
                      className="w-full bg-blue-400 rounded-t-sm transition-all duration-300 hover:bg-blue-500 min-h-[4px]"
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
            action={canEdit ? { label: "Add Impact Record", onClick: () => { setEditing({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setModalOpen(true); } } : undefined}
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
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{r.peopleReached.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setEditing(r); setModalOpen(true); }} className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded transition-colors">{canEdit ? "Edit" : "View"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(EMPTY); }} title={editing.id ? (canEdit ? "Edit Record" : "View Record") : "Add Impact Record"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
            <input disabled={!canEdit} type="text" value={editing.projectName} onChange={(e) => setEditing({ ...editing, projectName: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50" placeholder="e.g., Youth Leadership Program" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">People Reached *</label>
              <input disabled={!canEdit} type="number" min={1} value={editing.peopleReached || ""} onChange={(e) => setEditing({ ...editing, peopleReached: parseInt(e.target.value) || 0 })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50" placeholder="50" />
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Activity Type</label>
              <select disabled={!canEdit}
                value={editing.activityType}
                onChange={(e) => setEditing({ ...editing, activityType: e.target.value as ActivityType })}
                title="Activity Type"
                className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50"
              >
                {(Object.keys(ACTIVITY_CONFIG) as ActivityType[]).map((a) => (<option key={a} value={a}>{ACTIVITY_CONFIG[a].label}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea disabled={!canEdit} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 resize-none disabled:bg-slate-50" placeholder="Details about the activity..." />
          </div>
          {canEdit && (
            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveRecord} disabled={!editing.projectName.trim() || !editing.date || editing.peopleReached <= 0} className="flex-1  px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors">{editing.id ? "Save Changes" : "Add Record"}</button>
              {editing.id ? (
                <button onClick={() => { handleDeleteRecord(editing.id); setModalOpen(false); setEditing(EMPTY); }} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors">Delete</button>
              ) : null}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
