"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { getProjects, createProject, updateProject, deleteProject } from "@/app/actions/projects";
import type { ProjectRow } from "@/types";
import { type MemberChoice } from "@/components/MemberMultiSelect";
import EmptyState from "@/components/EmptyState";
import type { Session } from "@/lib/auth";
import { getStoredSkeletonMap, setStoredSkeletonMap } from "@/lib/loading-skeleton";
import { normalizeOwnerUserIds } from "@/lib/owner-users";
import {
  submitForReview,
  approveReview,
  rejectReview,
  getProjectReviewStatuses,
} from "@/app/actions/reviews";
import {
  COLUMNS,
  EMPTY_COLUMN_COUNTS,
  EMPTY_PROJECT,
  PROJECT_SKELETON_STORAGE_KEY,
  filterProjects,
  getDropPreviewIndex,
  getProjectPayload,
  isStatus,
  rowToProject,
  sortProjectsByPriority,
  type ProjectPriorityFilter,
  type Project,
  type Status,
} from "@/features/projects/board/model";
import {
  DraggableProjectCard,
  ProjectBoardHeader,
  ProjectBoardSkeleton,
  ProjectCardContent,
  ProjectColumn,
  ProjectFormModal,
  ProjectReviewModal,
} from "@/features/projects/board/ui";

export default function ProjectsBoardPageClient({
  initialSession,
  initialProjects,
  initialMembers,
  initialReviewStatuses,
}: {
  initialSession: Session | null;
  initialProjects: ProjectRow[];
  initialMembers: { id: number; name: string }[];
  initialReviewStatuses: Record<
    number,
    { status: string; reviewId: number; feedback: string | null }
  >;
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects.map(rowToProject));
  const [members] = useState<MemberChoice[]>(
    initialMembers
      .map((member) => ({ id: member.id, name: member.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project>(EMPTY_PROJECT);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<ProjectPriorityFilter>("all");
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragPreviewHeight, setDragPreviewHeight] = useState<number | null>(null);
  const [dragPreviewWidth, setDragPreviewWidth] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);
  const [session] = useState<Session | null>(initialSession);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeMobileColumn, setActiveMobileColumn] = useState(0);
  const [cachedColumnCounts, setCachedColumnCounts] = useState<Record<Status, number>>(
    EMPTY_COLUMN_COUNTS
  );
  const [reviewStatuses, setReviewStatuses] = useState<
    Record<number, { status: string; reviewId: number; feedback: string | null }>
  >(initialReviewStatuses);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ projectId: number; reviewId: number; projectName: string } | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const deepLinkHandledRef = useRef(false);
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
    if (deepLinkHandledRef.current) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const urlReviewId = urlParams.get("reviewId");
    const urlProjectId = urlParams.get("projectId");
    if (!urlReviewId || !urlProjectId) {
      return;
    }

    deepLinkHandledRef.current = true;
    const pid = Number(urlProjectId);
    const rid = Number(urlReviewId);
    const targetProject = initialProjects.find((project) => project.id === pid) ?? null;

    if (targetProject && Number.isInteger(rid)) {
      setTimeout(() => {
        setReviewTarget({
          projectId: pid,
          reviewId: rid,
          projectName: targetProject.name,
        });
        setReviewFeedback("");
        setReviewModalOpen(true);
      }, 300);
    }
  }, [initialProjects]);

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

  const isHeadOrAdmin = session && (
    session.role === "ADMIN" ||
    session.role === "HEAD"
  );

  const refreshProjects = async ({ showSkeleton = false }: { showSkeleton?: boolean } = {}) => {
    if (showSkeleton) {
      setIsLoadingData(true);
    }

    try {
      const [res, revStatuses] = await Promise.all([
        getProjects(),
        getProjectReviewStatuses(),
      ]);
      if (res.success && res.projects) {
        setProjects(res.projects.map(rowToProject));
      }
      setReviewStatuses(revStatuses);
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
    const column = columnRefs.current[index];

    if (!column) return;

    column.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
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
    setEditing(EMPTY_PROJECT);
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
      ...EMPTY_PROJECT,
      status,
      ownerUserIds: normalizeOwnerUserIds(session?.userId ? [session.userId] : []),
    });
    setModalOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setModalOpen(true);
  };

  /* ─── Review actions ─── */
  const handleSubmitForReview = async (projectId: number) => {
    const result = await submitForReview("project", projectId);
    if (result.success) {
      void refreshProjects();
    }
  };

  const handleApproveReview = async () => {
    if (!reviewTarget) return;
    setReviewSaving(true);
    const result = await approveReview(reviewTarget.reviewId, reviewFeedback || undefined);
    setReviewSaving(false);
    if (result.success) {
      setReviewModalOpen(false);
      setReviewTarget(null);
      setReviewFeedback("");
      void refreshProjects();
    }
  };

  const handleRejectReview = async () => {
    if (!reviewTarget || !reviewFeedback.trim()) return;
    setReviewSaving(true);
    const result = await rejectReview(reviewTarget.reviewId, reviewFeedback);
    setReviewSaving(false);
    if (result.success) {
      setReviewModalOpen(false);
      setReviewTarget(null);
      setReviewFeedback("");
      void refreshProjects();
    }
  };

  const openReviewModal = (projectId: number, reviewId: number, projectName: string) => {
    setReviewTarget({ projectId, reviewId, projectName });
    setReviewFeedback("");
    setReviewModalOpen(true);
  };

  /* ─── Drag & Drop ─── */
  const moveProjectToColumn = async (project: Project, col: Status) => {
    if (project.status === col) {
      return;
    }

    // Block moving to completed if not HEAD/ADMIN and not approved
    if (col === "completed" && !isHeadOrAdmin) {
      const rs = reviewStatuses[project.id];
      if (!rs || rs.status !== "approved") {
        return; // silently block
      }
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
  const filtered = filterProjects(projects, {
    search,
    priority: filterPriority,
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
      <ProjectBoardHeader
        isLoadingData={isLoadingData}
        projectCount={projects.length}
        search={search}
        filterPriority={filterPriority}
        canEdit={!!canEdit}
        onSearchChange={setSearch}
        onFilterPriorityChange={setFilterPriority}
        onCreateProject={() => openNew()}
      />

      {/* Kanban Board */}
      <div className="max-w-[1400px] mx-auto flex w-full flex-1 min-h-0 flex-col py-6 sm:px-6">
        {showMobileColumnDots && (
          <div className="mb-3 flex items-center justify-center gap-2 px-4 lg:hidden">
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
          <div className="px-4 lg:px-0 flex-1 min-h-0">
            <ProjectBoardSkeleton
              counts={skeletonColumnCounts}
              boardRef={boardRef}
              columnRefs={columnRefs}
            />
          </div>
        ) : projects.length === 0 ? (
          <div className="px-4 lg:px-0">
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
          </div>
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
              className={`hide-scrollbar flex flex-1 min-h-0 gap-4 overflow-x-auto overflow-y-hidden px-4 pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0 overscroll-x-contain scroll-px-4 ${
                isDragging ? "" : "snap-x snap-mandatory"
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
                      const rs = reviewStatuses[p.id] || null;

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
                            reviewStatus={rs}
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
                      reviewStatus={reviewStatuses[draggedProject.id] || null}
                    />
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <ProjectFormModal
        open={modalOpen}
        project={editing}
        canEdit={!!canEdit}
        isHeadOrAdmin={!!isHeadOrAdmin}
        members={members}
        reviewStatus={editing.id ? reviewStatuses[editing.id] || null : null}
        onClose={() => {
          setModalOpen(false);
          setEditing(EMPTY_PROJECT);
        }}
        onProjectChange={setEditing}
        onSave={saveProject}
        onDelete={() => {
          void handleDelete(editing.id);
          setModalOpen(false);
          setEditing(EMPTY_PROJECT);
        }}
        onSubmitForReview={() => {
          void handleSubmitForReview(editing.id);
        }}
        onOpenReview={() => {
          const status = reviewStatuses[editing.id];
          if (!status) return;
          setModalOpen(false);
          openReviewModal(editing.id, status.reviewId, editing.name);
        }}
        formatProjectUpdate={formatProjectUpdate}
      />

      <ProjectReviewModal
        open={reviewModalOpen}
        reviewTarget={reviewTarget}
        reviewFeedback={reviewFeedback}
        reviewSaving={reviewSaving}
        onClose={() => {
          setReviewModalOpen(false);
          setReviewTarget(null);
          setReviewFeedback("");
        }}
        onFeedbackChange={setReviewFeedback}
        onApprove={handleApproveReview}
        onReject={handleRejectReview}
      />
    </div>
  );
}
