"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { getMembers, addMember, deleteMember, updateMember } from "@/app/actions/members";
import { getCurrentSession } from "@/app/actions/session";
import { avatarColor, getInitials } from "@/lib/member-avatar";
import { getStoredSkeletonCount, resolveSkeletonCount, setStoredSkeletonCount } from "@/lib/loading-skeleton";
import TeamSubnav from "@/components/TeamSubnav";

import type { Session } from "@/lib/auth";

/* ─── Types ─── */

interface TeamMember {
  id: number;
  name: string;
  role: string;
  department: string;
  email: string;
  position: string;
  created_at: string;
}

const DEPT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  "PR & Social": { label: "PR & Social", color: "bg-purple-100 text-purple-700 border-purple-200", bg: "bg-purple-500" },
  Logistics: { label: "Logistics", color: "bg-blue-100 text-blue-700 border-blue-200", bg: "bg-blue-500" },
  Projects: { label: "Projects", color: "bg-emerald-100 text-emerald-700 border-emerald-200", bg: "bg-emerald-500" },
  Management: { label: "Management", color: "bg-amber-100 text-amber-700 border-amber-200", bg: "bg-amber-500" },
  Other: { label: "Other", color: "bg-slate-100 text-slate-600 border-slate-200", bg: "bg-slate-400" },
};

const TEAM_SKELETON_STORAGE_KEY = "team-directory-skeleton-count";

function sortMembers(items: TeamMember[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function TeamDirectorySkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="animate-pulse rounded-xl border border-purple-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-slate-200" />
              <div className="space-y-2">
                <div className="h-4 w-28 rounded-full bg-slate-200" />
                <div className="h-3 w-20 rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="h-8 w-16 rounded-lg bg-slate-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 w-24 rounded-full bg-slate-100" />
            <div className="h-5 w-16 rounded-full bg-slate-100" />
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="h-3 w-40 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [cachedMemberCount, setCachedMemberCount] = useState(0);
  
  // Add Form State
  const [formData, setFormData] = useState({ fullName: "", role: "", department: "Other", email: "", systemRole: "MEMBER" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit Form State
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editData, setEditData] = useState({ fullName: "", email: "", department: "Other", systemRole: "MEMBER", position: "" });
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    setCachedMemberCount(getStoredSkeletonCount(TEAM_SKELETON_STORAGE_KEY, 0));
  }, []);

  useEffect(() => {
    async function init() {
      setIsLoadingData(true);
      try {
        const sess = await getCurrentSession();
        setSession(sess);

        const res = await getMembers();
        if (res.success && res.members) {
          setMembers(sortMembers(res.members as TeamMember[]));
        }
      } finally {
        setIsLoadingData(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (isLoadingData) return;

    setCachedMemberCount(members.length);
    setStoredSkeletonCount(TEAM_SKELETON_STORAGE_KEY, members.length);
  }, [isLoadingData, members.length]);

  const refreshMembers = async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
    if (showLoading) {
      setIsLoadingData(true);
    }

    try {
      const current = await getMembers();
      if (current.success && current.members) {
        setMembers(sortMembers(current.members as TeamMember[]));
      }
    } finally {
      if (showLoading) {
        setIsLoadingData(false);
      }
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.role.trim() || !formData.department) return;
    
    setLoading(true);
    setError("");
    
    const res = await addMember(formData);
    
    if (res.error) {
      setError(res.error);
    } else {
      if (typeof res.id === "number") {
        setMembers((current) =>
          sortMembers([
            {
              id: res.id,
              name: formData.fullName.trim(),
              role: formData.systemRole || "MEMBER",
              department: formData.department,
              email: formData.email.trim(),
              position: formData.role.trim(),
              created_at:
                typeof res.createdAt === "string" && res.createdAt
                  ? res.createdAt
                  : new Date().toISOString(),
            },
            ...current,
          ])
        );
      }
      setModalOpen(false);
      setFormData({ fullName: "", role: "", department: "Other", email: "", systemRole: "MEMBER" });
      void refreshMembers();
    }
    setLoading(false);
  };

  const openEditModal = (m: TeamMember) => {
    setEditingMember(m);
    setEditData({
      fullName: m.name,
      email: m.email,
      department: m.department,
      systemRole: m.role,
      position: m.position || "",
    });
    setEditError("");
    setEditModalOpen(true);
  };

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editData.fullName.trim() || !editData.email.trim()) return;

    setEditLoading(true);
    setEditError("");

    const previousMember = members.find((member) => member.id === editingMember.id);

    if (previousMember) {
      setMembers((current) =>
        sortMembers(
          current.map((member) =>
            member.id === editingMember.id
              ? {
                  ...member,
                  name: editData.fullName.trim(),
                  email: editData.email.trim(),
                  department: editData.department,
                  role: editData.systemRole || "MEMBER",
                  position: editData.position.trim(),
                }
              : member
          )
        )
      );
    }

    const res = await updateMember(editingMember.id, editData);

    if (res.error) {
      if (previousMember) {
        setMembers((current) =>
          sortMembers(
            current.map((member) =>
              member.id === previousMember.id ? previousMember : member
            )
          )
        );
      }
      setEditError(res.error);
    } else {
      setEditModalOpen(false);
      setEditingMember(null);
      void refreshMembers();
    }
    setEditLoading(false);
  };

  const handleDeleteMember = async (id: number) => {
    if (!confirm("Are you sure you want to delete this member?")) return;
    const deletedMember = members.find((member) => member.id === id);

    setMembers((current) => current.filter((member) => member.id !== id));

    const res = await deleteMember(id);

    if (res.error) {
      if (deletedMember) {
        setMembers((current) => sortMembers([deletedMember, ...current]));
      }
      return;
    }

    void refreshMembers();
  };

  const filtered = members.filter((m) => {
    if (filterDept !== "all" && m.department !== filterDept) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.role.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const memberSkeletonCount = resolveSkeletonCount(
    members.length,
    cachedMemberCount
  );

  const canEdit = session && (session.role === "ADMIN" || session.role === "HEAD");

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
            <p className="text-xs text-slate-500 mt-0.5">
              {isLoadingData ? "Loading members..." : `${members.length} member${members.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <TeamSubnav active="directory" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or role..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 sm:w-56"
            />
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 sm:w-44"
            >
              <option value="all">All departments</option>
              {Object.keys(DEPT_CONFIG).map((d) => (<option key={d} value={d}>{DEPT_CONFIG[d].label}</option>))}
            </select>
            {canEdit && (
              <button
                onClick={() => setModalOpen(true)}
                className="h-10 w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700 sm:w-auto"
              >+ Add Member</button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {isLoadingData ? (
          <TeamDirectorySkeleton count={memberSkeletonCount} />
        ) : members.length === 0 ? (
          <EmptyState
            title="No team members yet"
            description="Add your organization's team members to build your directory."
            icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            action={canEdit ? { label: "Add Team Member", onClick: () => setModalOpen(true) } : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => {
              const dc = DEPT_CONFIG[m.department] || DEPT_CONFIG["Other"];
              return (
                <div key={m.id} className="bg-white rounded-xl border border-purple-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-12 h-12 rounded-full ${avatarColor(m.name)} text-white flex items-center justify-center text-base font-bold shadow-sm shrink-0`}>
                        {getInitials(m.name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-800 truncate">{m.name}</h3>
                        <p className="text-xs text-slate-500 truncate">{m.position || m.department}</p>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        {!(session?.role === "HEAD" && m.role === "ADMIN") && (
                          <button
                            onClick={() => openEditModal(m)}
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Edit Member"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}
                        {m.role !== "ADMIN" && (
                          <button
                            onClick={() => handleDeleteMember(m.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove Member"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${dc.color}`}>{dc.label}</span>
                    {m.role === "ADMIN" && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Admin</span>}
                    {m.role === "HEAD" && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Head</span>}
                  </div>
                  {m.email && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                        <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {m.email}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Add Member Modal ─── */}
      {canEdit && (
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Team Member">
          <form onSubmit={handleAddMember} className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
              <input required type="text" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400" placeholder="e.g., Jane Doe" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role / Position *</label>
                <input required type="text" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400" placeholder="e.g., Coordinator" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
                <select required value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400">
                  {Object.keys(DEPT_CONFIG).map((d) => (<option key={d} value={d}>{DEPT_CONFIG[d].label}</option>))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input required type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400" placeholder="user@flh.org" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Access Level *</label>
                <select required value={formData.systemRole} onChange={(e) => setFormData({ ...formData, systemRole: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400">
                  <option value="MEMBER">Member</option>
                  <option value="HEAD">Head</option>
                  {session?.role === "ADMIN" && <option value="ADMIN">Admin</option>}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Head = full access like Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button disabled={loading} type="submit" className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-75 text-white text-sm font-medium rounded-lg transition-colors">
                {loading ? "Adding..." : "Add Member"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Edit Member Modal ─── */}
      {canEdit && editingMember && (
        <Modal open={editModalOpen} onClose={() => { setEditModalOpen(false); setEditingMember(null); }} title="Edit Team Member">
          {(() => {
            const isSelfEdit = session?.role === "HEAD" && editingMember && session.email === editingMember.email;
            return (
              <form onSubmit={handleEditMember} className="space-y-4">
                {editError && <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm">{editError}</div>}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                  <input required type="text" value={editData.fullName} onChange={(e) => setEditData({ ...editData, fullName: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Role / Position</label>
                    <input type="text" value={editData.position} onChange={(e) => setEditData({ ...editData, position: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400" placeholder="e.g., Coordinator" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
                    <select required value={editData.department} onChange={(e) => setEditData({ ...editData, department: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400">
                      {Object.keys(DEPT_CONFIG).map((d) => (<option key={d} value={d}>{DEPT_CONFIG[d].label}</option>))}
                    </select>
                  </div>
                </div>
                {!isSelfEdit && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Access Level *</label>
                        <select required value={editData.systemRole} onChange={(e) => setEditData({ ...editData, systemRole: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400">
                          <option value="MEMBER">Member</option>
                          <option value="HEAD">Head</option>
                          {session?.role === "ADMIN" && <option value="ADMIN">Admin</option>}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">Head = full access like Admin</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                        <input required type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400" />
                      </div>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-3 pt-2">
                  <button type="button" onClick={() => { setEditModalOpen(false); setEditingMember(null); }} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button disabled={editLoading} type="submit" className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-75 text-white text-sm font-medium rounded-lg transition-colors">
                    {editLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
