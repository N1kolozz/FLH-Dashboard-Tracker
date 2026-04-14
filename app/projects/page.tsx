"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { getProjects, createProject, updateProject, deleteProject } from "@/app/actions/projects";
import type { ProjectRow } from "@/app/actions/projects";
import { getMembers } from "@/app/actions/members";
import MemberAvatarStack from "@/components/MemberAvatarStack";
import MemberMultiSelect, { type MemberChoice } from "@/components/MemberMultiSelect";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import ProjectsSubnav from "@/components/ProjectsSubnav";
import { getCurrentSession } from "@/app/actions/session";
import type { Session } from "@/lib/auth";
import { getStoredSkeletonMap, setStoredSkeletonMap } from "@/lib/loading-skeleton";

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
  updatedAt: string;
}

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "planning", label: "Planning", color: "border-t-slate-400" },
  { id: "in_progress", label: "In Progress", color: "border-t-blue-500" },
  { id: "review", label: "Review", color: "border-t-amber-500" },
  { id: "completed", label: "Completed", color: "border-t-green-500" },
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

const PROJECT_SKELETON_STORAGE_KEY = "project-board-skeleton-counts";
const EMPTY_COLUMN_COUNTS: Record<Status, number> = {
  planning: 0,
  in_progress: 0,
  review: 0,
  completed: 0,
};

function isStatus(value: string): value is Status {
  return COLUMNS.some((column) => column.id === value);
}

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
  updatedAt: "",
};

function getProjectPayload(project: Project) {
  return {
    name: project.name.trim(),
    description: project.description,
    status: project.status,
    priority: project.priority,
    deadline: project.deadline,
    team: project.team,
    tags: project.tags,
    ownerUserIds: project.ownerUserIds,
  };
}

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
    updatedAt: row.updated_at,
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

function ProjectBoardSkeleton({
  counts,
  boardRef,
  columnRefs,
}: {
  counts: Record<Status, number>;
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  columnRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
}) {
  return (
    <div
      ref={boardRef}
      className="hide-scrollbar flex flex-1 min-h-0 gap-4 overflow-x-auto overflow-y-hidden pb-2 scroll-smooth snap-x snap-mandatory lg:overflow-x-visible lg:pb-0"
    >
      {COLUMNS.map((column, index) => (
        <div
          key={column.id}
          ref={(node) => {
            columnRefs.current[index] = node;
          }}
          className={`w-full min-w-full shrink-0 snap-start overflow-hidden rounded-xl border border-slate-200 bg-white/70 ${column.color} border-t-2 flex min-h-0 flex-col lg:w-auto lg:min-w-0 lg:max-w-none lg:flex-1`}
        >
          <div className="flex shrink-0 items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
              <div className="h-5 w-8 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="h-6 w-6 animate-pulse rounded-md bg-slate-100" />
          </div>
          <div className="flex-1 min-h-0 space-y-2 overflow-y-auto px-3 pb-3 overscroll-contain">
            {Array.from({ length: counts[column.id] }).map((_, idx) => (
              <div
                key={idx}
                className="animate-pulse rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/80 p-4"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="h-5 w-14 rounded-full bg-slate-200" />
                  <div className="h-5 w-16 rounded-full bg-slate-100" />
                </div>
                <div className="space-y-2.5">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5">
                    <div className="flex gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-20 rounded-full bg-slate-100" />
                        <div className="h-4 w-32 rounded-full bg-slate-200" />
                      </div>
                    </div>
                  </div>
                  <div className="h-16 rounded-xl bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectCardContent({
  project,
  owners,
  daysUntilDeadline,
}: {
  project: Project;
  owners: MemberChoice[];
  daysUntilDeadline: (deadline: string) => number | null;
}) {
  const dl = daysUntilDeadline(project.deadline);

  return (
    <>
      <div
        className={`absolute inset-x-0 top-0 h-1 ${PRIORITY_CONFIG[project.priority].accent}`}
      />

      <div className="mb-4 flex items-start justify-between gap-3">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${PRIORITY_CONFIG[project.priority].classes}`}
        >
          {PRIORITY_CONFIG[project.priority].label}
        </span>
        {dl !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              dl < 0
                ? "bg-rose-50 text-rose-600"
                : dl <= 3
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              />
            </svg>
          }
        >
          <h4 className="text-[15px] font-semibold text-slate-900 leading-snug break-words">
            {project.name}
          </h4>
        </CardSection>

        {project.description && (
          <CardSection
            label="Description"
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h7m-7 4h10M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            }
          >
            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
              {project.description}
            </p>
          </CardSection>
        )}

        {project.team && (
          <CardSection
            label="Team / Assignee"
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            }
          >
            <p className="text-sm font-medium text-slate-700 break-words">{project.team}</p>
          </CardSection>
        )}

        {owners.length > 0 && (
          <CardSection
            label="Owners"
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
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
    </>
  );
}

function DraggableProjectCard({
  project,
  owners,
  canEdit,
  isDimmed,
  cardRefs,
  onOpen,
  daysUntilDeadline,
}: {
  project: Project;
  owners: MemberChoice[];
  canEdit: boolean;
  isDimmed: boolean;
  cardRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  onOpen: (project: Project) => void;
  daysUntilDeadline: (deadline: string) => number | null;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: project.id,
    disabled: !canEdit,
  });

  const setCombinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    cardRefs.current[project.id] = node;
  };

  return (
    <div
      ref={setCombinedRef}
      onClick={() => onOpen(project)}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/80 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 ${
        canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${isDimmed ? "opacity-50" : ""}`}
      {...attributes}
      {...(listeners ?? {})}
    >
      <ProjectCardContent
        project={project}
        owners={owners}
        daysUntilDeadline={daysUntilDeadline}
      />
    </div>
  );
}

function ProjectColumn({
  column,
  index,
  columnRefs,
  cardCount,
  canEdit,
  isActive,
  onAdd,
  children,
}: {
  column: { id: Status; label: string; color: string };
  index: number;
  columnRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  cardCount: number;
  canEdit: boolean;
  isActive: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
  });

  const setCombinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    columnRefs.current[index] = node;
  };

  const isHighlighted = isActive || isOver;

  return (
    <div
      ref={setCombinedRef}
      className={`relative flex min-h-0 w-full min-w-full shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/70 ${column.color} border-t-2 transition-colors lg:w-auto lg:min-w-0 lg:max-w-none lg:flex-1 ${
        isHighlighted ? "bg-blue-50/60 border-blue-200" : ""
      }`}
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">{column.label}</h3>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            {cardCount}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={onAdd}
            className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Add here"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      <div className="relative z-10 flex-1 min-h-0 space-y-2 overflow-y-auto px-3 pb-3 overscroll-contain">
        {children}
      </div>
    </div>
  );
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
  const [dragPreviewWidth, setDragPreviewWidth] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeMobileColumn, setActiveMobileColumn] = useState(0);
  const [cachedColumnCounts, setCachedColumnCounts] = useState<Record<Status, number>>(
    EMPTY_COLUMN_COUNTS
  );
  const boardRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<Array<HTMLDivElement | null>>([]);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const suppressOpenAfterDragRef = useRef(false);
  const suppressOpenTimeoutRef = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    })
  );

  useEffect(() => {
    setCachedColumnCounts(
      getStoredSkeletonMap(PROJECT_SKELETON_STORAGE_KEY, EMPTY_COLUMN_COUNTS)
    );
  }, []);

  useEffect(() => {
    async function init() {
      setIsLoadingData(true);
      try {
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
      } finally {
        setIsLoadingData(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    let frameId: number | null = null;

    const updateActiveColumn = () => {
      const boardCenter = board.scrollLeft + board.clientWidth / 2;
      let nextIndex = 0;
      let smallestDistance = Number.POSITIVE_INFINITY;

      columnRefs.current.forEach((column, index) => {
        if (!column) return;

        const columnCenter = column.offsetLeft + column.offsetWidth / 2;
        const distance = Math.abs(columnCenter - boardCenter);

        if (distance < smallestDistance) {
          smallestDistance = distance;
          nextIndex = index;
        }
      });

      setActiveMobileColumn(nextIndex);
    };

    const queueUpdate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(updateActiveColumn);
    };

    queueUpdate();
    board.addEventListener("scroll", queueUpdate, { passive: true });
    window.addEventListener("resize", queueUpdate);

    return () => {
      board.removeEventListener("scroll", queueUpdate);
      window.removeEventListener("resize", queueUpdate);

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [isLoadingData, projects.length]);

  useEffect(() => {
    return () => {
      if (suppressOpenTimeoutRef.current !== null) {
        window.clearTimeout(suppressOpenTimeoutRef.current);
      }
    };
  }, []);

  const canEdit = session && (
    session.role === "ADMIN" ||
    session.role === "HEAD" ||
    session.department === "Projects"
  );

  const refreshProjects = async ({ showSkeleton = false }: { showSkeleton?: boolean } = {}) => {
    if (showSkeleton) {
      setIsLoadingData(true);
    }

    try {
      const res = await getProjects();
      if (res.success && res.projects) {
        setProjects(res.projects.map(rowToProject));
      }
    } finally {
      if (showSkeleton) {
        setIsLoadingData(false);
      }
    }
  };

  const clearDragState = () => {
    setDragId(null);
    setDragPreviewHeight(null);
    setDragPreviewWidth(null);
    setDragOverCol(null);

    if (suppressOpenTimeoutRef.current !== null) {
      window.clearTimeout(suppressOpenTimeoutRef.current);
    }

    suppressOpenTimeoutRef.current = window.setTimeout(() => {
      suppressOpenAfterDragRef.current = false;
      suppressOpenTimeoutRef.current = null;
    }, 120);
  };

  const scrollToMobileColumn = (index: number) => {
    const board = boardRef.current;
    const column = columnRefs.current[index];

    if (!board || !column) return;

    board.scrollTo({
      left: column.offsetLeft,
      behavior: "smooth",
    });
    setActiveMobileColumn(index);
  };

  /* ─── CRUD ─── */
  const saveProject = async () => {
    const nowIso = new Date().toISOString();
    const nextProject = {
      ...editing,
      name: editing.name.trim(),
    };

    if (!nextProject.name) return;

    if (nextProject.id) {
      const previousProject = projects.find((project) => project.id === nextProject.id);

      setProjects((current) =>
        current.map((project) =>
          project.id === nextProject.id
            ? {
                ...nextProject,
                createdAt: previousProject?.createdAt ?? project.createdAt,
                updatedAt: nowIso,
              }
            : project
        )
      );

      const result = await updateProject(nextProject.id, getProjectPayload(nextProject));

      if (!result.success) {
        if (previousProject) {
          setProjects((current) =>
            current.map((project) =>
              project.id === previousProject.id ? previousProject : project
            )
          );
        }
        return;
      }
    } else {
      const result = await createProject(getProjectPayload(nextProject));

      if (!result.success || typeof result.id !== "number") {
        return;
      }

      setProjects((current) => [
        {
          ...nextProject,
          id: result.id,
          createdAt:
            typeof result.createdAt === "string" && result.createdAt
              ? result.createdAt
              : new Date().toISOString(),
          updatedAt:
            typeof result.updatedAt === "string" && result.updatedAt
              ? result.updatedAt
              : typeof result.createdAt === "string" && result.createdAt
                ? result.createdAt
                : new Date().toISOString(),
        },
        ...current,
      ]);
    }

    setModalOpen(false);
    setEditing(EMPTY);
    void refreshProjects();
  };

  const handleDelete = async (id: number) => {
    const deletedProject = projects.find((project) => project.id === id);

    setProjects((current) => current.filter((project) => project.id !== id));

    const result = await deleteProject(id);

    if (!result.success) {
      if (deletedProject) {
        setProjects((current) => [deletedProject, ...current]);
      }
      return;
    }

    void refreshProjects();
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
  const moveProjectToColumn = async (project: Project, col: Status) => {
    if (project.status === col) {
      return;
    }

    const nextProject = {
      ...project,
      status: col,
      updatedAt: new Date().toISOString(),
    };

    setProjects((current) =>
      current.map((item) => (item.id === nextProject.id ? nextProject : item))
    );

    const result = await updateProject(nextProject.id, getProjectPayload(nextProject));

    if (!result.success) {
      setProjects((current) =>
        current.map((item) => (item.id === project.id ? project : item))
      );
      return;
    }

    void refreshProjects();
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEdit) return;

    const nextDragId = Number(event.active.id);
    const cardNode = cardRefs.current[nextDragId];
    const cardRect = cardNode?.getBoundingClientRect();

    suppressOpenAfterDragRef.current = true;
    if (suppressOpenTimeoutRef.current !== null) {
      window.clearTimeout(suppressOpenTimeoutRef.current);
      suppressOpenTimeoutRef.current = null;
    }

    setDragId(nextDragId);
    setDragPreviewHeight(cardRect ? cardRect.height : null);
    setDragPreviewWidth(cardRect ? cardRect.width : null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id;

    if (typeof overId === "string" && isStatus(overId)) {
      setDragOverCol(overId);
      return;
    }

    setDragOverCol(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const activeId = Number(event.active.id);
    const overId = event.over?.id;
    const project = projects.find((item) => item.id === activeId) ?? null;

    clearDragState();

    if (!project || typeof overId !== "string" || !isStatus(overId)) {
      return;
    }

    await moveProjectToColumn(project, overId);
  };

  const handleDragCancel = () => {
    clearDragState();
  };

  const handleOpenProject = (project: Project) => {
    if (suppressOpenAfterDragRef.current) {
      return;
    }

    openEdit(project);
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
  const draggedOwners = draggedProject ? getOwnerMembers(draggedProject.ownerUserIds) : [];
  const isDragging = dragId !== null;
  const dropPreviewStyle = dragPreviewHeight
    ? { height: `${dragPreviewHeight}px` }
    : undefined;

  const daysUntilDeadline = (deadline: string) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    return diff;
  };

  const formatProjectUpdate = (value: string) => {
    if (!value) return "Not updated yet";

    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const projectColumnCounts = useMemo(
    () =>
      COLUMNS.reduce<Record<Status, number>>((acc, column) => {
        acc[column.id] = projects.filter((project) => project.status === column.id).length;
        return acc;
      }, { ...EMPTY_COLUMN_COUNTS }),
    [projects]
  );

  useEffect(() => {
    if (isLoadingData) return;

    setCachedColumnCounts(projectColumnCounts);
    setStoredSkeletonMap(PROJECT_SKELETON_STORAGE_KEY, projectColumnCounts);
  }, [isLoadingData, projectColumnCounts]);

  const skeletonColumnCounts = COLUMNS.reduce<Record<Status, number>>(
    (acc, column) => {
      acc[column.id] =
        projectColumnCounts[column.id] > 0
          ? projectColumnCounts[column.id]
          : cachedColumnCounts[column.id] > 0
            ? cachedColumnCounts[column.id]
            : 1;
      return acc;
    },
    { ...EMPTY_COLUMN_COUNTS }
  );
  const showMobileColumnDots = isLoadingData || projects.length > 0;

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-slate-50 md:h-screen">
      {/* Header */}
      <header className="shrink-0 border-b border-purple-200/70 bg-blue-100/80 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Project Board
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isLoadingData
                  ? "Loading projects..."
                  : `${projects.length} project${projects.length !== 1 ? "s" : ""} · Drag cards to change status`}
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
          <ProjectsSubnav className="mt-4" />
        </div>
      </header>

      {/* Kanban Board */}
      <div className="max-w-[1400px] mx-auto flex w-full flex-1 min-h-0 flex-col px-4 py-6 sm:px-6">
        {showMobileColumnDots && (
          <div className="mb-3 flex items-center justify-center gap-2 lg:hidden">
            {COLUMNS.map((column, index) => {
              const isActive = activeMobileColumn === index;

              return (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => scrollToMobileColumn(index)}
                  aria-label={`Go to ${column.label}`}
                  aria-pressed={isActive}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-200 ${
                    isActive
                      ? "bg-blue-600 ring-4 ring-blue-100"
                      : "bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              );
            })}
          </div>
        )}

        {isLoadingData ? (
          <ProjectBoardSkeleton
            counts={skeletonColumnCounts}
            boardRef={boardRef}
            columnRefs={columnRefs}
          />
        ) : projects.length === 0 ? (
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
          <DndContext
            autoScroll={!!canEdit}
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div
              ref={boardRef}
              className={`hide-scrollbar flex flex-1 min-h-0 gap-4 overflow-x-auto overflow-y-hidden pb-2 lg:overflow-x-visible lg:pb-0 ${
                isDragging ? "" : "scroll-smooth snap-x snap-mandatory"
              }`}
            >
              {COLUMNS.map((col, index) => {
                const items = columnProjects(col.id);
                const previewIndex =
                  dragOverCol === col.id
                    ? getDropPreviewIndex(items, draggedProject, col.id)
                    : null;

                return (
                  <ProjectColumn
                    key={col.id}
                    column={col}
                    index={index}
                    columnRefs={columnRefs}
                    cardCount={items.length}
                    canEdit={!!canEdit}
                    isActive={dragOverCol === col.id}
                    onAdd={() => openNew(col.id)}
                  >
                    {items.length === 0 && previewIndex === 0 && (
                      <div
                        aria-hidden="true"
                        style={dropPreviewStyle}
                        className="min-h-[112px] rounded-2xl border border-slate-300/70 bg-slate-200/45"
                      />
                    )}

                    {items.map((p, cardIndex) => {
                      const owners = getOwnerMembers(p.ownerUserIds);

                      return (
                        <Fragment key={p.id}>
                          {previewIndex === cardIndex && (
                            <div
                              aria-hidden="true"
                              style={dropPreviewStyle}
                              className="min-h-[112px] rounded-2xl border border-slate-300/70 bg-slate-200/45"
                            />
                          )}

                          <DraggableProjectCard
                            project={p}
                            owners={owners}
                            canEdit={!!canEdit}
                            isDimmed={dragId === p.id}
                            cardRefs={cardRefs}
                            onOpen={handleOpenProject}
                            daysUntilDeadline={daysUntilDeadline}
                          />
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
                  </ProjectColumn>
                );
              })}
            </div>

            <DragOverlay>
              {draggedProject ? (
                <div
                  style={dragPreviewWidth ? { width: `${dragPreviewWidth}px` } : undefined}
                  className="pointer-events-none"
                >
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/80 p-4 shadow-2xl">
                    <ProjectCardContent
                      project={draggedProject}
                      owners={draggedOwners}
                      daysUntilDeadline={daysUntilDeadline}
                    />
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
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

          {editing.id ? (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Last updated: <span className="font-medium text-slate-700">{formatProjectUpdate(editing.updatedAt)}</span>
            </div>
          ) : null}

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
                  onClick={() => {
                    void handleDelete(editing.id);
                    setModalOpen(false);
                    setEditing(EMPTY);
                  }}
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
