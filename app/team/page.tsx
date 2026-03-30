"use client";

import { useState, useEffect } from "react";
import { loadStore, saveStore, generateId } from "@/lib/store";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";

/* ─── Types ─── */
type Department = "pr" | "logistics" | "projects" | "management" | "other";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: Department;
  email: string;
  phone: string;
  createdAt: string;
}

const STORE_KEY = "flh_team";

const DEPT_CONFIG: Record<Department, { label: string; color: string; bg: string }> = {
  pr: { label: "PR & Social", color: "bg-purple-100 text-purple-700 border-purple-200", bg: "bg-purple-500" },
  logistics: { label: "Logistics", color: "bg-blue-100 text-blue-700 border-blue-200", bg: "bg-blue-500" },
  projects: { label: "Projects", color: "bg-emerald-100 text-emerald-700 border-emerald-200", bg: "bg-emerald-500" },
  management: { label: "Management", color: "bg-amber-100 text-amber-700 border-amber-200", bg: "bg-amber-500" },
  other: { label: "Other", color: "bg-slate-100 text-slate-600 border-slate-200", bg: "bg-slate-400" },
};

const EMPTY: TeamMember = { id: "", name: "", role: "", department: "other", email: "", phone: "", createdAt: "" };

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  "bg-cyan-500", "bg-indigo-500", "bg-pink-500", "bg-teal-500", "bg-orange-500",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember>(EMPTY);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState<Department | "all">("all");

  useEffect(() => { setMembers(loadStore<TeamMember>(STORE_KEY)); }, []);
  const persist = (next: TeamMember[]) => { setMembers(next); saveStore(STORE_KEY, next); };

  const saveMember = () => {
    if (!editing.name.trim()) return;
    let next: TeamMember[];
    if (editing.id) {
      next = members.map((m) => (m.id === editing.id ? editing : m));
    } else {
      next = [...members, { ...editing, id: generateId(), createdAt: new Date().toISOString() }];
    }
    persist(next);
    setModalOpen(false);
    setEditing(EMPTY);
  };

  const deleteMember = (id: string) => { persist(members.filter((m) => m.id !== id)); };

  const filtered = members.filter((m) => {
    if (filterDept !== "all" && m.department !== filterDept) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.role.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-purple-200/70 bg-gradient-to-r from-violet-50/70 via-purple-50/65 to-fuchsia-50/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Team Directory
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or role..."
              className="px-3 text-slate-500 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 w-48"
            />
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value as Department | "all")}
              className="px-3 text-slate-500 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="all">All departments</option>
              {(Object.keys(DEPT_CONFIG) as Department[]).map((d) => (<option key={d} value={d}>{DEPT_CONFIG[d].label}</option>))}
            </select>
            <button
              onClick={() => { setEditing(EMPTY); setModalOpen(true); }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >+ Add Member</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {members.length === 0 ? (
          <EmptyState
            title="No team members yet"
            description="Add your organization's team members to build your directory."
            icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            action={{ label: "Add Team Member", onClick: () => { setEditing(EMPTY); setModalOpen(true); } }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => {
              const dc = DEPT_CONFIG[m.department];
              return (
                <div
                  key={m.id}
                  onClick={() => { setEditing(m); setModalOpen(true); }}
                  className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-full ${avatarColor(m.name)} text-white flex items-center justify-center text-base font-bold shadow-sm`}>
                      {getInitials(m.name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-800 truncate">{m.name}</h3>
                      {m.role && <p className="text-xs text-slate-500 truncate">{m.role}</p>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${dc.color}`}>{dc.label}</span>
                  {(m.email || m.phone) && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                      {m.email && (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                          <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          {m.email}
                        </p>
                      )}
                      {m.phone && (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          {m.phone}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(EMPTY); }} title={editing.id ? "Edit Member" : "Add Team Member"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
            <input type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400" placeholder="e.g., Nikoloz Osievi" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role / Position</label>
              <input type="text" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400" placeholder="e.g., Project Manager" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <select value={editing.department} onChange={(e) => setEditing({ ...editing, department: e.target.value as Department })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400">
                {(Object.keys(DEPT_CONFIG) as Department[]).map((d) => (<option key={d} value={d}>{DEPT_CONFIG[d].label}</option>))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400" placeholder="ahmed@flh.org" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input type="tel" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400" placeholder="+995 555 123 456" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={saveMember} disabled={!editing.name.trim()} className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors">{editing.id ? "Save Changes" : "Add Member"}</button>
            {editing.id && (
              <button onClick={() => { deleteMember(editing.id); setModalOpen(false); setEditing(EMPTY); }} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors">Delete</button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
