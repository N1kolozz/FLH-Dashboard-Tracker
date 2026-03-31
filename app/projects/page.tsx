"use client";

import { useState, useEffect } from "react";
import { getProjects, createProject, updateProject, deleteProject } from "@/app/actions/projects";
import type { ProjectRow } from "@/app/actions/projects";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { getCurrentSession } from "@/app/actions/session";
import type { Session } from "@/lib/auth";

/* ─── Types ─── */
type Priority = "low" | "medium" | "high";
type Status = "planning" | "in_progress" | "review" | "completed";

interface Project {
  id: number;
  name: string;
  description: string;
  status: Status;
  priority: Priority;
  deadline: string;
  team: string;
  tags: string[];
  createdAt: string;
}

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "planning", label: "Planning", color: "border-t-slate-400" },
  { id: "in_progress", label: "In Progress", color: "border-t-blue-500" },
  { id: "review", label: "Review", color: "border-t-amber-500" },
  { id: "completed", label: "Completed", color: "border-t-blue-500" },
];

const PRIORITY_CONFIG: Record<Priority, { label: string; classes: string }> = {
  high: { label: "High", classes: "bg-rose-100 text-rose-700 border-rose-200" },
  medium: { label: "Medium", classes: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { label: "Low", classes: "bg-slate-100 text-slate-600 border-slate-200" },
};

const EMPTY: Project = {
  id: 0,
  name: "",
  description: "",
  status: "planning",
  priority: "medium",
  deadline: "",
  team: "",
  tags: [],
  createdAt: "",
};

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as Status,
    priority: row.priority as Priority,
    deadline: row.deadline || "",
    team: row.team,
    tags: row.tags || [],
    createdAt: row.created_at,
  };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project>(EMPTY);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  // Load from database
  useEffect(() => {
    async function init() {
      const sess = await getCurrentSession();
      setSession(sess);
      const res = await getProjects();
      if (res.success && res.projects) {
        setProjects(res.projects.map(rowToProject));
      }
    }
    init();
  }, []);

  const canEdit = session && (
    session.role === "ADMIN" || 
    session.role === "HEAD" || 
    session.department === "Projects"
  );

  const refreshProjects = async () => {
    const res = await getProjects();
    if (res.success && res.projects) {
      setProjects(res.projects.map(rowToProject));
    }
  };

  /* ─── CRUD ─── */
  const saveProject = async () => {
    if (!editing.name.trim()) return;
    if (editing.id) {
      await updateProject(editing.id, {
        name: editing.name,
        description: editing.description,
        status: editing.status,
        priority: editing.priority,
        deadline: editing.deadline,
        team: editing.team,
        tags: editing.tags,
      });
    } else {
      await createProject({
        name: editing.name,
        description: editing.description,
        status: editing.status,
        priority: editing.priority,
        deadline: editing.deadline,
        team: editing.team,
        tags: editing.tags,
      });
    }
    await refreshProjects();
    setModalOpen(false);
    setEditing(EMPTY);
  };

  const handleDelete = async (id: number) => {
    await deleteProject(id);
    await refreshProjects();
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
  const handleDragStart = (id: number) => { if (canEdit) setDragId(id); };

  const handleDragOver = (e: React.DragEvent, col: Status) => {
    if (!canEdit) return;
    e.preventDefault();
    setDragOverCol(col);
  };

  const handleDrop = async (col: Status) => {
    if (dragId) {
      const project = projects.find((p) => p.id === dragId);
      if (project) {
        await updateProject(dragId, {
          name: project.name,
          description: project.description,
          status: col,
          priority: project.priority,
          deadline: project.deadline,
          team: project.team,
          tags: project.tags,
        });
        await refreshProjects();
      }
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
      <header className="border-b border-purple-200/70 bg-blue-100/80 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Project Board
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="px-3 text-slate-500 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 w-44"
            />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as Priority | "all")}
              title="Filter priority"
              className="px-3 text-slate-500 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            {canEdit && (
              <button
                onClick={() => openNew()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                + New Project
              </button>
            )}
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
            action={canEdit ? { label: "Create Project", onClick: () => openNew() } : undefined}
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
                    {canEdit && (
                      <button
                        onClick={() => openNew(col.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Add here"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="px-3 pb-3 space-y-2">
                    {items.map((p) => {
                      const dl = daysUntilDeadline(p.deadline);
                      return (
                        <div
                          key={p.id}
                          draggable={!!canEdit}
                          onDragStart={() => handleDragStart(p.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => openEdit(p)}
                          className={`bg-white rounded-lg border border-slate-100 p-3 ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} shadow-sm hover:shadow-md transition-all duration-150 hover:-translate-y-0.5 ${
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
        title={editing.id ? (canEdit ? "Edit Project" : "View Project") : "New Project"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
            <input disabled={!canEdit}
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 disabled:bg-slate-50"
              placeholder="e.g., Youth Leadership Program"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea disabled={!canEdit}
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              rows={3}
              className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 resize-none disabled:bg-slate-50"
              placeholder="Brief description of the project..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select disabled={!canEdit}
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as Status })}
                title="Status"
                className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select disabled={!canEdit}
                value={editing.priority}
                onChange={(e) => setEditing({ ...editing, priority: e.target.value as Priority })}
                title="Priority"
                className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
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
              <input disabled={!canEdit}
                type="date"
                value={editing.deadline}
                onChange={(e) => setEditing({ ...editing, deadline: e.target.value })}
                title="Deadline"
                className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team / Assignee</label>
              <input disabled={!canEdit}
                type="text"
                value={editing.team}
                onChange={(e) => setEditing({ ...editing, team: e.target.value })}
                className="w-full text-slate-500 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
                placeholder="e.g., PR Team"
              />
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveProject}
                disabled={!editing.name.trim()}
                className="flex-1  px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {editing.id ? "Save Changes" : "Create Project"}
              </button>
              {editing.id ? (
                <button
                  onClick={() => { handleDelete(editing.id); setModalOpen(false); setEditing(EMPTY); }}
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
  );
}
