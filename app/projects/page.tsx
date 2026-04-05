"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { getProjects, createProject, updateProject, deleteProject } from "@/app/actions/projects";
import type { ProjectRow } from "@/app/actions/projects";
import { getMembers } from "@/app/actions/members";
import MemberAvatarStack from "@/components/MemberAvatarStack";
import MemberMultiSelect, { type MemberChoice } from "@/components/MemberMultiSelect";
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
  ownerUserIds: number[];
  createdAt: string;
}

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "planning", label: "Planning", color: "border-t-slate-400" },
  { id: "in_progress", label: "In Progress", color: "border-t-blue-500" },
  { id: "review", label: "Review", color: "border-t-amber-500" },
  { id: "completed", label: "Completed", color: "border-t-blue-500" },
];

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; classes: string; accent: string }
> = {
  high: {
    label: "High",
    classes: "bg-rose-100 text-rose-700 border-rose-200",
    accent: "bg-rose-400",
  },
  medium: {
    label: "Medium",
    classes: "bg-amber-100 text-amber-700 border-amber-200",
    accent: "bg-amber-400",
  },
  low: {
    label: "Low",
    classes: "bg-slate-100 text-slate-600 border-slate-200",
    accent: "bg-slate-400",
  },
};

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function CardSection({
  label,
  icon,
  children,
  className = "",
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 ${className}`}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm ring-1 ring-slate-200/80">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-500 mb-1">{label}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

const EMPTY: Project = {
  id: 0,
  name: "",
  description: "",
  status: "planning",
  priority: "medium",
  deadline: "",
  team: "",
  tags: [],
  ownerUserIds: [],
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
    ownerUserIds: (row.owner_user_ids || []).map(Number),
    createdAt: row.created_at,
  };
}

function sortProjectsByPriority(items: Project[]) {
  return [...items].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function getDropPreviewIndex(
  items: Project[],
  draggedProject: Project | null,
  targetStatus: Status
) {
  if (!draggedProject || draggedProject.status === targetStatus) {
    return null;
  }

  const previewItems = sortProjectsByPriority([
    ...items,
    {
      ...draggedProject,
      status: targetStatus,
    },
  ]);

  return previewItems.findIndex((project) => project.id === draggedProject.id);
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<MemberChoice[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project>(EMPTY);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragPreviewHeight, setDragPreviewHeight] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const dragIdRef = useRef<number | null>(null);

  useEffect(() => {
    async function init() {
      const [sess, projectRes, memberRes] = await Promise.all([
        getCurrentSession(),
        getProjects(),
        getMembers(),
      ]);
      setSession(sess);
      if (projectRes.success && projectRes.projects) {
        setProjects(projectRes.projects.map(rowToProject));
      }
      if (memberRes.success && memberRes.members) {
        const nextMembers = (memberRes.members as { id: number; name: string }[])
          .map((member) => ({ id: member.id, name: member.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setMembers(nextMembers);
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

  const clearDragState = () => {
    dragIdRef.current = null;
    setDragId(null);
    setDragPreviewHeight(null);
    setDragOverCol(null);
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
        ownerUserIds: editing.ownerUserIds,
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
        ownerUserIds: editing.ownerUserIds,
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
    setEditing({
      ...EMPTY,
      status,
      ownerUserIds: session?.userId ? [Number(session.userId)] : [],
    });
    setModalOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setModalOpen(true);
  };

  /* ─── Drag & Drop ─── */
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    if (!canEdit) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-project-id", String(id));
    e.dataTransfer.setData("text/plain", String(id));
    dragIdRef.current = id;
    setDragPreviewHeight(e.currentTarget.getBoundingClientRect().height);
    setDragId(id);
  };

  const handleDragOver = (e: React.DragEvent, col: Status) => {
    if (!canEdit || dragIdRef.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(col);
  };

  const handleDrop = async (e: React.DragEvent, col: Status) => {
    e.preventDefault();

    const droppedId =
      Number(e.dataTransfer.getData("application/x-project-id")) ||
      Number(e.dataTransfer.getData("text/plain")) ||
      dragIdRef.current ||
      dragId;

    const project = droppedId
      ? projects.find((item) => item.id === droppedId) ?? null
      : null;

    clearDragState();

    if (!project || project.status === col) {
      return;
    }

    await updateProject(project.id, {
      name: project.name,
      description: project.description,
      status: col,
      priority: project.priority,
      deadline: project.deadline,
      team: project.team,
      tags: project.tags,
      ownerUserIds: project.ownerUserIds,
    });
    await refreshProjects();
  };

  const handleDragEnd = () => {
    window.setTimeout(clearDragState, 0);
  };

  /* ─── Filtering ─── */
  const filtered = projects.filter((p) => {
    if (filterPriority !== "all" && p.priority !== filterPriority) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columnProjects = (status: Status) =>
    sortProjectsByPriority(filtered.filter((p) => p.status === status));
  const getOwnerMembers = (ownerUserIds: number[]) =>
    members.filter((member) => ownerUserIds.includes(member.id));
  const draggedProject = dragId
    ? projects.find((project) => project.id === dragId) ?? null
    : null;
  const isDragging = dragId !== null;
  const dropPreviewStyle = dragPreviewHeight
    ? { height: `${dragPreviewHeight}px` }
    : undefined;

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
          <div className="grid grid-cols-1 items-start sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map((col) => {
              const items = columnProjects(col.id);
              const previewIndex =
                dragOverCol === col.id
                  ? getDropPreviewIndex(items, draggedProject, col.id)
                  : null;

              return (
                <div
                  key={col.id}
                  onDragEnterCapture={(e) => handleDragOver(e, col.id)}
                  onDragOverCapture={(e) => handleDragOver(e, col.id)}
                  onDropCapture={(e) => { void handleDrop(e, col.id); }}
                  className={`relative self-start overflow-visible rounded-xl border border-slate-200 bg-white/70 ${col.color} border-t-2 transition-colors ${
                    dragOverCol === col.id ? "bg-blue-50/60 border-blue-200" : ""
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

                  {isDragging && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-x-0 top-[52px] z-0 h-[100vh] opacity-0"
                    />
                  )}

                  {/* Cards */}
                  <div className="relative z-10 px-3 pb-3 space-y-2">
                    {items.length === 0 && previewIndex === 0 && (
                      <div
                        aria-hidden="true"
                        style={dropPreviewStyle}
                        className="min-h-[112px] rounded-2xl border border-slate-300/70 bg-slate-200/45"
                      />
                    )}

                    {items.map((p, index) => {
                      const dl = daysUntilDeadline(p.deadline);
                      const owners = getOwnerMembers(p.ownerUserIds);

                      return (
                        <Fragment key={p.id}>
                          {previewIndex === index && (
                            <div
                              aria-hidden="true"
                              style={dropPreviewStyle}
                              className="min-h-[112px] rounded-2xl border border-slate-300/70 bg-slate-200/45"
                            />
                          )}

                          <div
                            draggable={!!canEdit}
                            onDragStart={(e) => handleDragStart(e, p.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => openEdit(p)}
                            className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/80 p-4 ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} hover:border-slate-300 transition-all duration-200 hover:-translate-y-0.5 ${
                              dragId === p.id ? "opacity-50" : ""
                            }`}
                          >
                            <div
                              className={`absolute inset-x-0 top-0 h-1 ${PRIORITY_CONFIG[p.priority].accent}`}
                            />

                            {/* Priority + Deadline */}
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${PRIORITY_CONFIG[p.priority].classes}`}>
                                {PRIORITY_CONFIG[p.priority].label}
                              </span>
                              {dl !== null && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                  dl < 0
                                    ? "bg-rose-50 text-rose-600"
                                    : dl <= 3
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-slate-100 text-slate-500"
                                }`}>
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {dl < 0 ? `${Math.abs(dl)}d overdue` : dl === 0 ? "Due today" : `${dl}d left`}
                                </span>
                              )}
                            </div>

                            <div className="space-y-2.5">
                              <CardSection
                                label="Project Name"
                                icon={
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                                  </svg>
                                }
                              >
                                <h4 className="text-[15px] font-semibold text-slate-900 leading-snug break-words">
                                  {p.name}
                                </h4>
                              </CardSection>

                              {p.description && (
                                <CardSection
                                  label="Description"
                                  icon={
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h7m-7 4h10M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                  }
                                >
                                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                                    {p.description}
                                  </p>
                                </CardSection>
                              )}

                              {p.team && (
                                <CardSection
                                  label="Team / Assignee"
                                  icon={
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  }
                                >
                                  <p className="text-sm font-medium text-slate-700 break-words">{p.team}</p>
                                </CardSection>
                              )}

                              {owners.length > 0 && (
                                <CardSection
                                  label="Owners"
                                  icon={
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  }
                                >
                                  <div className="flex items-center gap-2">
                                    <MemberAvatarStack
                                      names={owners.map((owner) => owner.name)}
                                      size="md"
                                      maxVisible={4}
                                    />
                                    <p className="text-xs text-slate-600 truncate">
                                      {owners.map((owner) => owner.name).join(", ")}
                                    </p>
                                  </div>
                                </CardSection>
                              )}
                            </div>
                          </div>
                        </Fragment>
                      );
                    })}

                    {items.length > 0 && previewIndex === items.length && (
                      <div
                        aria-hidden="true"
                        style={dropPreviewStyle}
                        className="min-h-[112px] rounded-2xl border border-slate-300/70 bg-slate-200/45"
                      />
                    )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <MemberMultiSelect
            members={members}
            selectedIds={editing.ownerUserIds}
            onChange={(ownerUserIds) => setEditing({ ...editing, ownerUserIds })}
            disabled={!canEdit}
          />

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
