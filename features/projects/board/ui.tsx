import type { MutableRefObject, ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import MemberAvatarStack from "@/components/MemberAvatarStack";
import MemberMultiSelect, { type MemberChoice } from "@/components/MemberMultiSelect";
import Modal from "@/components/Modal";
import ProjectsSubnav from "@/components/ProjectsSubnav";
import {
  COLUMNS,
  EMPTY_COLUMN_COUNTS,
  EMPTY_PROJECT,
  PRIORITY_CONFIG,
  type Priority,
  type Project,
  type ProjectPriorityFilter,
  type ProjectReviewStatus,
  type Status,
} from "@/features/projects/board/model";

function CardLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-wide text-slate-400 ${className}`}>
      {children}
    </p>
  );
}

export function ProjectBoardSkeleton({
  counts,
  boardRef,
  columnRefs,
}: {
  counts: Record<Status, number>;
  boardRef: MutableRefObject<HTMLDivElement | null>;
  columnRefs: MutableRefObject<Array<HTMLDivElement | null>>;
}) {
  return (
    <div
      ref={boardRef}
      className="hide-scrollbar flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-2 scroll-smooth snap-x snap-mandatory lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0"
    >
      {COLUMNS.map((column, index) => (
        <div
          key={column.id}
          ref={(node) => {
            columnRefs.current[index] = node;
          }}
          className={`flex min-h-0 w-full min-w-full shrink-0 snap-start snap-always flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/70 ${column.color} border-t-2 lg:min-w-0 lg:w-full lg:snap-none`}
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
                className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="h-5 w-16 rounded-md bg-slate-200" />
                  <div className="h-5 w-14 rounded-md bg-slate-100" />
                </div>
                <div className="mb-2 h-5 w-32 rounded-md bg-slate-200" />
                <div className="mb-4 h-3 w-48 rounded-md bg-slate-100" />
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="h-3 w-20 rounded-md bg-slate-100" />
                  <div className="h-4 w-24 rounded-md bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectCardContent({
  project,
  owners,
  daysUntilDeadline,
  reviewStatus,
}: {
  project: Project;
  owners: MemberChoice[];
  daysUntilDeadline: (deadline: string) => number | null;
  reviewStatus?: ProjectReviewStatus | null;
}) {
  const deadlineDelta = daysUntilDeadline(project.deadline);

  return (
    <>
      <div
        className={`absolute inset-x-0 top-0 h-2 ${PRIORITY_CONFIG[project.priority].accent}`}
      />

      {/* Status Row: Priority + Deadline/Review */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${PRIORITY_CONFIG[project.priority].classes}`}
          >
            {PRIORITY_CONFIG[project.priority].label}
          </span>
          {reviewStatus?.status === "approved" && (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              Approved
            </span>
          )}
          {reviewStatus?.status === "pending" && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4v.01" />
              </svg>
              Review
            </span>
          )}
        </div>
        {deadlineDelta !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              deadlineDelta < 0
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : deadlineDelta <= 3
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-slate-300 bg-slate-100 text-slate-600"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {deadlineDelta < 0
              ? `${Math.abs(deadlineDelta)}d overdue`
              : deadlineDelta === 0
                ? "Due today"
                : `${deadlineDelta}d left`}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="mb-2 break-words text-base font-bold leading-tight text-slate-900">
        {project.name}
      </h4>

      {/* Description (optional) */}
      {project.description && (
        <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-slate-500">
          {project.description}
        </p>
      )}

      {/* Footer: Team + Owners */}
      <div className="border-t border-slate-100 pt-3 space-y-2">
        {project.team && (
          <div>
            <CardLabel className="mb-1">Team</CardLabel>
            <p className="text-sm font-medium text-slate-700">{project.team}</p>
          </div>
        )}

        {owners.length > 0 && (
          <div>
            <CardLabel className="mb-1">Owners</CardLabel>
            <div className="flex items-center gap-2">
              <MemberAvatarStack
                names={owners.map((owner) => owner.name)}
                size="sm"
                maxVisible={4}
              />
              <p className="truncate text-xs text-slate-600">
                {owners.map((owner) => owner.name).join(", ")}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function DraggableProjectCard({
  project,
  owners,
  canEdit,
  isDimmed,
  cardRefs,
  onOpen,
  daysUntilDeadline,
  reviewStatus,
}: {
  project: Project;
  owners: MemberChoice[];
  canEdit: boolean;
  isDimmed: boolean;
  cardRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  onOpen: (project: Project) => void;
  daysUntilDeadline: (deadline: string) => number | null;
  reviewStatus?: ProjectReviewStatus | null;
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
      className={`group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 ${
        canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${isDimmed ? "opacity-50" : ""}`}
      {...attributes}
      {...(listeners ?? {})}
    >
      <ProjectCardContent
        project={project}
        owners={owners}
        daysUntilDeadline={daysUntilDeadline}
        reviewStatus={reviewStatus}
      />
    </div>
  );
}

export function ProjectColumn({
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
  columnRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  cardCount: number;
  canEdit: boolean;
  isActive: boolean;
  onAdd: () => void;
  children: ReactNode;
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
      className={`relative flex min-h-0 w-full min-w-full shrink-0 snap-start snap-always flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/70 ${column.color} border-t-2 transition-colors lg:min-w-0 lg:w-full lg:snap-none ${
        isHighlighted ? "bg-blue-50/60 border-blue-200" : ""
      }`}
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">{column.label}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {cardCount}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={onAdd}
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            title="Add here"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

export function ProjectBoardHeader({
  isLoadingData,
  projectCount,
  search,
  filterPriority,
  canEdit,
  onSearchChange,
  onFilterPriorityChange,
  onCreateProject,
}: {
  isLoadingData: boolean;
  projectCount: number;
  search: string;
  filterPriority: ProjectPriorityFilter;
  canEdit: boolean;
  onSearchChange: (value: string) => void;
  onFilterPriorityChange: (value: ProjectPriorityFilter) => void;
  onCreateProject: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-purple-200/70 bg-blue-100/80 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              Project Board
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {isLoadingData
                ? "Loading projects..."
                : `${projectCount} project${projectCount !== 1 ? "s" : ""} · Drag cards to change status`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <input
              type="text"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search projects..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 sm:w-56"
            />
            <select
              value={filterPriority}
              onChange={(event) =>
                onFilterPriorityChange(event.target.value as ProjectPriorityFilter)
              }
              title="Filter priority"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 sm:w-44"
            >
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            {canEdit && (
              <button
                onClick={onCreateProject}
                className="inline-flex min-h-10 w-full items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto sm:min-w-[152px]"
              >
                + New Project
              </button>
            )}
          </div>
        </div>
        <ProjectsSubnav className="mt-4" />
      </div>
    </header>
  );
}

export function ProjectFormModal({
  open,
  project,
  canEdit,
  isHeadOrAdmin,
  members,
  reviewStatus,
  onClose,
  onProjectChange,
  onSave,
  onDelete,
  onSubmitForReview,
  onOpenReview,
  formatProjectUpdate,
}: {
  open: boolean;
  project: Project;
  canEdit: boolean;
  isHeadOrAdmin: boolean;
  members: MemberChoice[];
  reviewStatus: ProjectReviewStatus | null;
  onClose: () => void;
  onProjectChange: (project: Project) => void;
  onSave: () => void;
  onDelete: () => void;
  onSubmitForReview: () => void;
  onOpenReview: () => void;
  formatProjectUpdate: (value: string) => string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project.id ? (canEdit ? "Edit Project" : "View Project") : "New Project"}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Project Name *</label>
          <input
            disabled={!canEdit}
            type="text"
            value={project.name}
            onChange={(event) =>
              onProjectChange({ ...project, name: event.target.value })
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
            placeholder="e.g., Youth Leadership Program"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            disabled={!canEdit}
            value={project.description}
            onChange={(event) =>
              onProjectChange({ ...project, description: event.target.value })
            }
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
            placeholder="Brief description of the project..."
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              disabled={!canEdit}
              value={project.status}
              onChange={(event) =>
                onProjectChange({ ...project, status: event.target.value as Status })
              }
              title="Status"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
            >
              {COLUMNS.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
            <select
              disabled={!canEdit}
              value={project.priority}
              onChange={(event) =>
                onProjectChange({ ...project, priority: event.target.value as Priority })
              }
              title="Priority"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Deadline</label>
            <input
              disabled={!canEdit}
              type="date"
              value={project.deadline}
              onChange={(event) =>
                onProjectChange({ ...project, deadline: event.target.value })
              }
              title="Deadline"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Team / Assignee</label>
            <input
              disabled={!canEdit}
              type="text"
              value={project.team}
              onChange={(event) =>
                onProjectChange({ ...project, team: event.target.value })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-slate-50"
              placeholder="e.g., PR Team"
            />
          </div>
        </div>
        <MemberMultiSelect
          members={members}
          selectedIds={project.ownerUserIds}
          onChange={(ownerUserIds) => onProjectChange({ ...project, ownerUserIds })}
          disabled={!canEdit}
        />

        {project.id ? (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Last updated:{" "}
            <span className="font-medium text-slate-700">
              {formatProjectUpdate(project.updatedAt)}
            </span>
          </div>
        ) : null}

        {project.id ? (
          <div className="space-y-2">
            {reviewStatus?.status === "approved" && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold">Approved by management</span>
                {reviewStatus.feedback ? (
                  <span className="text-emerald-600">- {reviewStatus.feedback}</span>
                ) : null}
              </div>
            )}
            {reviewStatus?.status === "pending" && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">Pending review from HEAD/Admin</span>
              </div>
            )}
            {project.status === "review" &&
            (!reviewStatus || reviewStatus.status === "rejected") &&
            canEdit ? (
              <button
                onClick={onSubmitForReview}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Submit for Review
              </button>
            ) : null}
            {reviewStatus?.status === "pending" && isHeadOrAdmin ? (
              <button
                onClick={onOpenReview}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.743 7.523 5 12 5c4.478 0 8.268 2.743 9.542 7-1.274 4.257-5.064 7-9.542 7-4.477 0-8.268-2.743-9.542-7z" />
                </svg>
                Review This Project
              </button>
            ) : null}
          </div>
        ) : null}

        {canEdit ? (
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onSave}
              disabled={!project.name.trim()}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:bg-slate-300"
            >
              {project.id ? "Save Changes" : "Create Project"}
            </button>
            {project.id ? (
              <button
                onClick={onDelete}
                className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100"
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export function ProjectReviewModal({
  open,
  reviewTarget,
  reviewFeedback,
  reviewSaving,
  onClose,
  onFeedbackChange,
  onApprove,
  onReject,
}: {
  open: boolean;
  reviewTarget: { projectId: number; reviewId: number; projectName: string; projectDescription: string } | null;
  reviewFeedback: string;
  reviewSaving: boolean;
  onClose: () => void;
  onFeedbackChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Review Project">
      {reviewTarget ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
            <p className="text-sm text-slate-500">Project</p>
            <p className="text-base font-bold text-slate-900">{reviewTarget.projectName}</p>
            {reviewTarget.projectDescription ? (
              <>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {reviewTarget.projectDescription}
                </p>
              </>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Feedback <span className="text-slate-400">(required for rejection)</span>
            </label>
            <textarea
              value={reviewFeedback}
              onChange={(event) => onFeedbackChange(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
              placeholder="Add feedback or comments..."
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onApprove}
              disabled={reviewSaving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:bg-slate-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {reviewSaving ? "Approving..." : "Approve"}
            </button>
            <button
              onClick={onReject}
              disabled={reviewSaving || !reviewFeedback.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {reviewSaving ? "Rejecting..." : "Reject"}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
