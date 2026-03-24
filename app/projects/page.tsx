"use client";

import { useState, useEffect } from "react";
import { loadStore, saveStore, generateId } from "@/lib/store";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";

/* ─── Types ─── */
type Priority = "low" | "medium" | "high";
type Status = "planning" | "in_progress" | "review" | "completed";

interface Project {
  id: string;
  name: string;
  description: string;
  status: Status;
  priority: Priority;
  deadline: string;
  team: string;
  tags: string[];
  createdAt: string;
}

const STORE_KEY = "flh_projects";

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "planning", label: "Planning", color: "border-t-slate-400" },
  { id: "in_progress", label: "In Progress", color: "border-t-blue-500" },
  { id: "review", label: "Review", color: "border-t-amber-500" },
  { id: "completed", label: "Completed", color: "border-t-emerald-500" },
];

const PRIORITY_CONFIG: Record<Priority, { label: string; classes: string }> = {
  high: { label: "High", classes: "bg-rose-100 text-rose-700 border-rose-200" },
  medium: { label: "Medium", classes: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { label: "Low", classes: "bg-slate-100 text-slate-600 border-slate-200" },
};

const EMPTY: Project = {
  id: "",
  name: "",
  description: "",
  status: "planning",
  priority: "medium",
  deadline: "",
  team: "",
  tags: [],
  createdAt: "",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project>(EMPTY);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);

  // Load from localStorage
  useEffect(() => {
    setProjects(loadStore<Project>(STORE_KEY));
  }, []);

  const persist = (next: Project[]) => {
    setProjects(next);
    saveStore(STORE_KEY, next);
  };

  /* ─── CRUD ─── */
  const saveProject = () => {
    if (!editing.name.trim()) return;
    let next: Project[];
    if (editing.id) {
      next = projects.map((p) => (p.id === editing.id ? editing : p));
    } else {
      next = [...projects, { ...editing, id: generateId(), createdAt: new Date().toISOString() }];
    }
    persist(next);
    setModalOpen(false);
    setEditing(EMPTY);
  };

  const deleteProject = (id: string) => {
    persist(projects.filter((p) => p.id !== id));
  };

  const openNew = (status: Status = "planning") => {
    setEditing({ ...EMPTY, status });
    setModalOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setModalOpen(true);
  };

  /* ─── Drag & Drop ─── */
  const handleDragStart = (id: string) => setDragId(id);

  const handleDragOver = (e: React.DragEvent, col: Status) => {
    e.preventDefault();
    setDragOverCol(col);
  };

  const handleDrop = (col: Status) => {
    if (dragId) {
      const next = projects.map((p) => (p.id === dragId ? { ...p, status: col } : p));
      persist(next);
    }
    setDragId(null);
    setDragOverCol(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverCol(null);
  };

  /* ─── Filtering ─── */
  const filtered = projects.filter((p) => {
    if (filterPriority !== "all" && p.priority !== filterPriority) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columnProjects = (status: Status) => filtered.filter((p) => p.status === status);

  const daysUntilDeadline = (deadline: string) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-purple-200/70 bg-emerald-100/80 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Project Board
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {projects.length} project{projects.length !== 1 ? "s" : ""} · Drag cards to change status
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 w-44"
            />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as Priority | "all")}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              onClick={() => openNew()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              + New Project
            </button>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create your first project to start tracking work on the kanban board."
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            action={{ label: "Create Project", onClick: () => openNew() }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map((col) => {
              const items = columnProjects(col.id);
              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDrop={() => handleDrop(col.id)}
                  onDragLeave={() => setDragOverCol(null)}
                  className={`rounded-xl border border-slate-200 bg-white/70 ${col.color} border-t-2 min-h-[200px] transition-colors ${
                    dragOverCol === col.id ? "bg-purple-50/50 border-purple-200" : ""
                  }`}
                >
                  {/* Column header */}
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                        {items.length}
                      </span>
                    </div>
                    <button
                      onClick={() => openNew(col.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      title="Add here"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>

                  {/* Cards */}
                  <div className="px-3 pb-3 space-y-2">
                    {items.map((p) => {
                      const dl = daysUntilDeadline(p.deadline);
                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={() => handleDragStart(p.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => openEdit(p)}
                          className={`bg-white rounded-lg border border-slate-100 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all duration-150 hover:-translate-y-0.5 ${
                            dragId === p.id ? "opacity-50" : ""
                          }`}
                        >
                          {/* Priority + Deadline */}
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_CONFIG[p.priority].classes}`}>
                              {PRIORITY_CONFIG[p.priority].label}
                            </span>
                            {dl !== null && (
                              <span className={`text-[10px] font-medium ${dl < 0 ? "text-rose-600" : dl <= 3 ? "text-amber-600" : "text-slate-400"}`}>
                                {dl < 0 ? `${Math.abs(dl)}d overdue` : dl === 0 ? "Today" : `${dl}d left`}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-medium text-slate-800 leading-snug mb-1">{p.name}</h4>
                          {p.description && (
                            <p className="text-xs text-slate-500 line-clamp-2 mb-2">{p.description}</p>
                          )}
                          {p.team && (
                            <p className="text-[10px] text-slate-400">
                              <span className="font-medium text-slate-500">{p.team}</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(EMPTY); }}
        title={editing.id ? "Edit Project" : "New Project"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
              placeholder="e.g., Youth Leadership Program"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 resize-none"
              placeholder="Brief description of the project..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as Status })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={editing.priority}
                onChange={(e) => setEditing({ ...editing, priority: e.target.value as Priority })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
              <input
                type="date"
                value={editing.deadline}
                onChange={(e) => setEditing({ ...editing, deadline: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team / Assignee</label>
              <input
                type="text"
                value={editing.team}
                onChange={(e) => setEditing({ ...editing, team: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                placeholder="e.g., PR Team"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={saveProject}
              disabled={!editing.name.trim()}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {editing.id ? "Save Changes" : "Create Project"}
            </button>
            {editing.id && (
              <button
                onClick={() => { deleteProject(editing.id); setModalOpen(false); setEditing(EMPTY); }}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg border border-rose-200 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
