"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useConfirmDialog } from "@/components/ConfirmDialog";
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
  ProjectDetailModal,
  ProjectFormModal,
  ProjectReviewModal,
} from "@/features/projects/board/ui";
import FixedPortal from "@/components/FixedPortal";

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
  const { confirm: confirmDelete, dialog: confirmDialog } = useConfirmDialog();
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
  const [reviewTarget, setReviewTarget] = useState<{ projectId: number; reviewId: number; projectName: string; projectDescription: string } | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const deepLinkHandledRef = useRef(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<Array<HTMLDivElement | null>>([]);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const suppressOpenAfterDragRef = useRef(false);
  const suppressOpenTimeoutRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const mobileSwipeRef = useRef({
    tracking: false,
    horizontal: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
    startIndex: 0,
    startScrollLeft: 0,
  });

  const clampMobileColumnIndex = useCallback((index: number) => {
    return Math.min(Math.max(index, 0), COLUMNS.length - 1);
  }, []);

  const getColumnScrollLeft = useCallback(
    (index: number) => {
      const board = boardRef.current;
      const column = columnRefs.current[clampMobileColumnIndex(index)];

      if (!board || !column) {
        return 0;
      }

      const boardRect = board.getBoundingClientRect();
      const columnRect = column.getBoundingClientRect();
      const boardStyle = window.getComputedStyle(board);
      const paddingLeft = Number.parseFloat(boardStyle.paddingLeft) || 0;
      const maxScrollLeft = Math.max(0, board.scrollWidth - board.clientWidth);
      const targetScrollLeft =
        board.scrollLeft + columnRect.left - boardRect.left - paddingLeft;

      return Math.min(Math.max(targetScrollLeft, 0), maxScrollLeft);
    },
    [clampMobileColumnIndex]
  );

  const getNearestMobileColumnIndex = useCallback(() => {
    const board = boardRef.current;

    if (!board) {
      return 0;
    }

    let nextIndex = 0;
    let smallestDistance = Number.POSITIVE_INFINITY;

    COLUMNS.forEach((_, index) => {
      const distance = Math.abs(getColumnScrollLeft(index) - board.scrollLeft);

      if (distance < smallestDistance) {
        smallestDistance = distance;
        nextIndex = index;
      }
    });

    return nextIndex;
  }, [getColumnScrollLeft]);

  const scrollToMobileColumn = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const board = boardRef.current;

      if (!board) {
        return;
      }

      const nextIndex = clampMobileColumnIndex(index);

      board.scrollTo({
        left: getColumnScrollLeft(nextIndex),
        behavior,
      });
      setActiveMobileColumn(nextIndex);
    },
    [clampMobileColumnIndex, getColumnScrollLeft]
  );

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
          projectDescription: targetProject.description,
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
      setActiveMobileColumn(getNearestMobileColumnIndex());
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
  }, [getNearestMobileColumnIndex, isLoadingData, projects.length]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const isMobileBoard = () => window.matchMedia("(max-width: 1279px)").matches;
    const resetSnapStyles = () => {
      board.style.scrollBehavior = "";
      board.style.scrollSnapType = "";
    };
    const releaseCardOpenSuppression = () => {
      if (suppressOpenTimeoutRef.current !== null) {
        window.clearTimeout(suppressOpenTimeoutRef.current);
      }

      suppressOpenTimeoutRef.current = window.setTimeout(() => {
        suppressOpenAfterDragRef.current = false;
        suppressOpenTimeoutRef.current = null;
      }, 320);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!isMobileBoard() || isDraggingRef.current || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const now = performance.now();

      mobileSwipeRef.current = {
        tracking: true,
        horizontal: false,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastTime: now,
        velocityX: 0,
        startIndex: getNearestMobileColumnIndex(),
        startScrollLeft: board.scrollLeft,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const swipe = mobileSwipeRef.current;

      if (!swipe.tracking || isDraggingRef.current || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - swipe.startX;
      const deltaY = touch.clientY - swipe.startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (!swipe.horizontal) {
        if (absX < 8 && absY < 8) {
          return;
        }

        if (absY > absX * 1.1) {
          swipe.tracking = false;
          resetSnapStyles();
          return;
        }

        swipe.horizontal = true;
        suppressOpenAfterDragRef.current = true;
        if (suppressOpenTimeoutRef.current !== null) {
          window.clearTimeout(suppressOpenTimeoutRef.current);
          suppressOpenTimeoutRef.current = null;
        }
        board.style.scrollBehavior = "auto";
        board.style.scrollSnapType = "none";
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      const now = performance.now();
      const elapsed = Math.max(1, now - swipe.lastTime);
      swipe.velocityX = (touch.clientX - swipe.lastX) / elapsed;
      swipe.lastX = touch.clientX;
      swipe.lastTime = now;

      const maxScrollLeft = Math.max(0, board.scrollWidth - board.clientWidth);
      let nextScrollLeft = swipe.startScrollLeft - deltaX;

      if (nextScrollLeft < 0) {
        nextScrollLeft *= 0.35;
      } else if (nextScrollLeft > maxScrollLeft) {
        nextScrollLeft = maxScrollLeft + (nextScrollLeft - maxScrollLeft) * 0.35;
      }

      board.scrollLeft = nextScrollLeft;
    };

    const finishSwipe = () => {
      const swipe = mobileSwipeRef.current;

      if (!swipe.tracking) {
        resetSnapStyles();
        return;
      }

      swipe.tracking = false;

      if (!swipe.horizontal) {
        resetSnapStyles();
        return;
      }

      resetSnapStyles();

      const deltaX = swipe.lastX - swipe.startX;
      const distanceThreshold = Math.min(120, board.clientWidth * 0.22);
      const velocityThreshold = 0.45;
      let nextIndex = swipe.startIndex;

      if (deltaX <= -distanceThreshold || swipe.velocityX <= -velocityThreshold) {
        nextIndex += 1;
      } else if (deltaX >= distanceThreshold || swipe.velocityX >= velocityThreshold) {
        nextIndex -= 1;
      } else {
        nextIndex = getNearestMobileColumnIndex();
      }

      scrollToMobileColumn(nextIndex);
      releaseCardOpenSuppression();
    };

    board.addEventListener("touchstart", handleTouchStart, { passive: true });
    board.addEventListener("touchmove", handleTouchMove, { passive: false });
    board.addEventListener("touchend", finishSwipe, { passive: true });
    board.addEventListener("touchcancel", finishSwipe, { passive: true });

    return () => {
      board.removeEventListener("touchstart", handleTouchStart);
      board.removeEventListener("touchmove", handleTouchMove);
      board.removeEventListener("touchend", finishSwipe);
      board.removeEventListener("touchcancel", finishSwipe);
      resetSnapStyles();
    };
  }, [
    getNearestMobileColumnIndex,
    isLoadingData,
    projects.length,
    scrollToMobileColumn,
  ]);

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
    const ok = await confirmDelete({
      title: "Delete project?",
      message: deletedProject
        ? `Are you sure you want to delete "${deletedProject.name}"? This cannot be undone.`
        : "Are you sure you want to delete this project? This cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;

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

  const openReviewModal = (projectId: number, reviewId: number, projectName: string, projectDescription: string) => {
    setReviewTarget({ projectId, reviewId, projectName, projectDescription });
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

    setDetailProject(project);
  };

  const handleEditProject = (project: Project) => {
    if (suppressOpenAfterDragRef.current) {
      return;
    }

    setDetailProject(null);
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

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = "grabbing";
    } else {
      document.body.style.cursor = "";
    }
    return () => {
      document.body.style.cursor = "";
    };
  }, [isDragging]);

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
    <>
    {confirmDialog}
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
          <div className="mb-3 flex items-center justify-center gap-2 px-4 xl:hidden">
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
          <div className="px-4 xl:px-0 flex-1 min-h-0">
            <ProjectBoardSkeleton
              counts={skeletonColumnCounts}
              boardRef={boardRef}
              columnRefs={columnRefs}
            />
          </div>
        ) : projects.length === 0 ? (
          <div className="px-4 xl:px-0">
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
              className={`hide-scrollbar flex flex-1 min-h-0 touch-pan-y gap-4 overflow-x-auto overflow-y-hidden px-4 pb-2 xl:grid xl:grid-cols-4 xl:overflow-visible xl:px-0 xl:pb-0 overscroll-x-contain scroll-px-4 ${
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
                            onEdit={canEdit ? handleEditProject : undefined}
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

            <FixedPortal>
              <DragOverlay dropAnimation={null}>
                {draggedProject ? (
                  <div
                    style={dragPreviewWidth ? { width: `${dragPreviewWidth}px` } : undefined}
                    className="pointer-events-none"
                  >
                    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
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
            </FixedPortal>
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
        onDelete={async () => {
          const targetId = editing.id;
          await handleDelete(targetId);
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
          openReviewModal(editing.id, status.reviewId, editing.name, editing.description);
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

      <ProjectDetailModal
        open={detailProject !== null}
        project={detailProject}
        owners={detailProject ? getOwnerMembers(detailProject.ownerUserIds) : []}
        reviewStatus={detailProject ? reviewStatuses[detailProject.id] ?? null : null}
        canEdit={!!canEdit}
        daysUntilDeadline={daysUntilDeadline}
        formatProjectUpdate={formatProjectUpdate}
        onClose={() => setDetailProject(null)}
        onEdit={canEdit ? handleEditProject : undefined}
      />
    </div>
    </>
  );
}
