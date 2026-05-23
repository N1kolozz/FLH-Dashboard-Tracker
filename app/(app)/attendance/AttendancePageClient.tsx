"use client";

import { useCallback, useState } from "react";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import AppSelect from "@/components/ui/Select";
import type { EventRow } from "@/app/actions/events";
import {
  createAttendanceSession,
  deleteAttendanceSession,
  getAttendanceSessionDetails,
  getAttendanceSessions,
  getAttendanceStats,
  setAttendanceSessionActive,
  updateAttendanceRecord,
  updateAttendanceSession,
} from "@/app/actions/attendance";
import {
  type AttendanceRecordRow,
  type AttendanceSessionRow,
  type AttendanceStats,
  type AttendanceStatus,
} from "@/types";
import type { Session } from "@/lib/auth";
import { canManageAttendanceAndWorkload } from "@/lib/permissions";
import { avatarColor, getInitials } from "@/lib/member-avatar";

type AttendanceFormState = {
  eventId: string;
  title: string;
  meetingDate: string;
  instructions: string;
  isActive: boolean;
};

type AttendanceDetails = {
  session: AttendanceSessionRow;
  records: AttendanceRecordRow[];
};

type EventChoice = {
  id: number;
  title: string;
  date: string;
  time: string;
};

const EMPTY_FORM: AttendanceFormState = {
  eventId: "",
  title: "",
  meetingDate: "",
  instructions: "",
  isActive: false,
};

const STATUS_OPTIONS: Exclude<AttendanceStatus, "pending">[] = [
  "present",
  "absent",
  "excused",
];

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; chip: string; dot: string; activeButton: string }
> = {
  pending: {
    label: "Pending",
    chip: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    activeButton: "border-slate-300 bg-slate-100 text-slate-700",
  },
  present: {
    label: "Present",
    chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    activeButton: "border-emerald-300 bg-emerald-100 text-emerald-800",
  },
  absent: {
    label: "Absent",
    chip: "bg-rose-100 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    activeButton: "border-rose-300 bg-rose-100 text-rose-800",
  },
  excused: {
    label: "Excused",
    chip: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    activeButton: "border-amber-300 bg-amber-100 text-amber-800",
  },
};

function formatDate(value: string) {
  if (!value) return "No date";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRate(value: number | null | undefined) {
  if (typeof value !== "number") return "No data";
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function progressWidth(value: number | null | undefined) {
  if (typeof value !== "number") return "0%";
  return `${Math.min(Math.max(value, 0), 100)}%`;
}

function errorMessage(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function sessionRate(session: AttendanceSessionRow) {
  const recorded =
    session.present_count + session.absent_count + session.excused_count;
  if (recorded === 0) return null;
  return Math.round((session.present_count / recorded) * 1000) / 10;
}

export default function AttendancePage({
  initialSession,
  initialSessions,
  initialStats,
  initialEvents,
  initialDetails,
}: {
  initialSession: Session | null;
  initialSessions: AttendanceSessionRow[];
  initialStats: AttendanceStats | null;
  initialEvents: EventRow[];
  initialDetails: AttendanceDetails | null;
}) {
  const [session] = useState<Session | null>(initialSession);
  const [sessions, setSessions] = useState<AttendanceSessionRow[]>(initialSessions);
  const [details, setDetails] = useState<AttendanceDetails | null>(initialDetails);
  const [stats, setStats] = useState<AttendanceStats | null>(initialStats);
  const events: EventChoice[] = initialEvents.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
    }));
  const isLoading = false;
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AttendanceFormState>(EMPTY_FORM);
  const [savingSession, setSavingSession] = useState(false);
  const [savingRecordId, setSavingRecordId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const canManage = canManageAttendanceAndWorkload(session);

  const refreshDashboard = useCallback(async () => {
    const [sessionRes, statRes] = await Promise.all([
      getAttendanceSessions(),
      getAttendanceStats(),
    ]);

    if (sessionRes.success && sessionRes.sessions) {
      setSessions(sessionRes.sessions);
    } else if ("error" in sessionRes) {
      setError(errorMessage(sessionRes.error, "Failed to fetch attendance sessions"));
    }

    if (statRes.success && statRes.stats) {
      setStats(statRes.stats);
    }

    return sessionRes.success && sessionRes.sessions ? sessionRes.sessions : [];
  }, []);

  const loadDetails = useCallback(async (id: number) => {
    setIsDetailLoading(true);
    const res = await getAttendanceSessionDetails(id);
    if (res.success && res.session && res.records) {
      setDetails({ session: res.session, records: res.records });
    } else if ("error" in res) {
      setError(errorMessage(res.error, "Failed to fetch attendance details"));
    }
    setIsDetailLoading(false);
  }, []);

  const memberStats = stats?.member_stats ?? [];
  const selectedSessionRate = details ? sessionRate(details.session) : null;

  const selectEvent = (eventId: string) => {
    const linkedEvent = events.find((event) => event.id === Number(eventId));
    setForm((current) => ({
      ...current,
      eventId,
      title: linkedEvent?.title ?? current.title,
      meetingDate: linkedEvent?.date ?? current.meetingDate,
    }));
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (attendanceSession: AttendanceSessionRow) => {
    setEditingId(attendanceSession.id);
    setForm({
      eventId: attendanceSession.event_id ? String(attendanceSession.event_id) : "",
      title: attendanceSession.title,
      meetingDate: attendanceSession.meeting_date,
      instructions: attendanceSession.instructions,
      isActive: attendanceSession.is_active,
    });
    setError("");
    setModalOpen(true);
  };

  const saveSession = async () => {
    if (!form.title.trim() || !form.meetingDate) return;

    setSavingSession(true);
    setError("");

    const payload = {
      eventId: form.eventId ? Number(form.eventId) : null,
      title: form.title,
      meetingDate: form.meetingDate,
      instructions: form.instructions,
      isActive: form.isActive,
    };

    const result = editingId
      ? await updateAttendanceSession(editingId, payload)
      : await createAttendanceSession(payload);

    if (result.success) {
      setModalOpen(false);
      const refreshed = await refreshDashboard();
      const nextId = editingId ?? ("id" in result ? result.id : refreshed[0]?.id);
      if (typeof nextId === "number") {
        await loadDetails(nextId);
      }
    } else if ("error" in result) {
      setError(errorMessage(result.error, "Failed to save attendance"));
    }

    setSavingSession(false);
  };

  const toggleActivation = async (attendanceSession: AttendanceSessionRow) => {
    setError("");
    const result = await setAttendanceSessionActive(
      attendanceSession.id,
      !attendanceSession.is_active
    );
    if (result.success) {
      await refreshDashboard();
      await loadDetails(attendanceSession.id);
    } else if ("error" in result) {
      setError(errorMessage(result.error, "Failed to update attendance activation"));
    }
  };

  const removeSession = async (attendanceSession: AttendanceSessionRow) => {
    if (!confirm(`Delete attendance for "${attendanceSession.title}"?`)) return;
    setError("");
    const result = await deleteAttendanceSession(attendanceSession.id);
    if (result.success) {
      setDetails(null);
      const refreshed = await refreshDashboard();
      if (refreshed[0]) {
        await loadDetails(refreshed[0].id);
      }
    } else if ("error" in result) {
      setError(errorMessage(result.error, "Failed to delete attendance"));
    }
  };

  const updateLocalRecord = (
    userId: number,
    patch: Partial<AttendanceRecordRow>
  ) => {
    setDetails((current) => {
      if (!current) return current;
      return {
        ...current,
        records: current.records.map((record) =>
          record.user_id === userId ? { ...record, ...patch } : record
        ),
      };
    });
  };

  const saveRecord = async (
    record: AttendanceRecordRow,
    patch: Partial<Pick<AttendanceRecordRow, "status" | "note" | "reason">> = {}
  ) => {
    if (!details) return;

    const nextRecord = { ...record, ...patch };
    updateLocalRecord(record.user_id, nextRecord);
    setSavingRecordId(record.id);
    setError("");

    const result = await updateAttendanceRecord(details.session.id, record.user_id, {
      status: nextRecord.status,
      note: nextRecord.note,
      reason: nextRecord.reason,
    });

    if (result.success) {
      await refreshDashboard();
      await loadDetails(details.session.id);
    } else if ("error" in result) {
      setError(errorMessage(result.error, "Failed to update attendance record"));
      await loadDetails(details.session.id);
    }

    setSavingRecordId(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-purple-50/30">
        <header className="border-b border-purple-200/70 bg-gradient-to-r from-violet-50/80 via-purple-50/70 to-fuchsia-50/80">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
            <div className="h-6 w-52 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded-full bg-slate-100" />
          </div>
        </header>
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[360px_1fr]">
          <div className="h-96 animate-pulse rounded-2xl border border-purple-100 bg-white" />
          <div className="h-96 animate-pulse rounded-2xl border border-purple-100 bg-white" />
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-purple-50/30">
        <header className="border-b border-purple-200/70 bg-gradient-to-r from-violet-50/80 via-purple-50/70 to-fuchsia-50/80">
          <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
            <h1 className="text-xl font-bold text-slate-900">Meeting Attendance</h1>
            <p className="mt-1 text-sm text-slate-600">
              Attendance management is available to ADMIN, HEAD, and Management.
            </p>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <EmptyState
            title="Access needed"
            description="Ask a HEAD or Management member to manage attendance records."
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-purple-50/30">
      <header className="border-b border-purple-200/70 bg-gradient-to-r from-violet-50/80 via-purple-50/70 to-fuchsia-50/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              Meeting Attendance
              <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14m-9 4l2 2 4-4M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {sessions.length} attendance sheet{sessions.length === 1 ? "" : "s"} tracked
            </p>
          </div>
          <button
            onClick={openNew}
            className="h-10 w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 sm:w-auto"
          >
            + New Attendance
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-purple-200/80 bg-white p-4 shadow-sm shadow-purple-100/40">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Attendance Sheets</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Linked meetings and event prompts</p>
                </div>
                <button
                  onClick={openNew}
                  className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                >
                  Add
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {sessions.length === 0 ? (
                  <EmptyState
                    title="No attendance yet"
                    description="Create a meeting attendance sheet to start tracking responses."
                    action={{ label: "Create Attendance", onClick: openNew }}
                    icon={
                      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3M5 11h14m-9 4l2 2 4-4M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    }
                  />
                ) : (
                  sessions.map((attendanceSession) => {
                    const active =
                      details?.session.id === attendanceSession.id;
                    return (
                      <button
                        key={attendanceSession.id}
                        onClick={() => loadDetails(attendanceSession.id)}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          active
                            ? "border-purple-300 bg-purple-50/80"
                            : "border-purple-100 bg-white hover:bg-purple-50/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {attendanceSession.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {formatDate(attendanceSession.meeting_date)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              attendanceSession.is_active
                                ? "border-purple-200 bg-purple-100 text-purple-700"
                                : "border-slate-200 bg-slate-100 text-slate-500"
                            }`}
                          >
                            {attendanceSession.is_active ? "Active" : "Paused"}
                          </span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-purple-500"
                            style={{ width: progressWidth(sessionRate(attendanceSession)) }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {attendanceSession.present_count} present · {attendanceSession.absent_count} absent · {attendanceSession.excused_count} excused
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-purple-200/80 bg-white p-4 shadow-sm shadow-purple-100/40">
              <h2 className="text-sm font-semibold text-slate-900">Attendance By Department</h2>
              <div className="mt-4 space-y-3">
                {(stats?.department_stats ?? []).map((department) => (
                  <div key={department.department}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-700">{department.department}</span>
                      <span className="text-xs font-semibold text-slate-500">{formatRate(department.attendance_rate)}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-purple-500"
                        style={{ width: progressWidth(department.attendance_rate) }}
                      />
                    </div>
                  </div>
                ))}
                {(stats?.department_stats ?? []).length === 0 && (
                  <p className="text-sm text-slate-500">No department data yet.</p>
                )}
              </div>
            </div>

          </div>

          <div className="rounded-2xl border border-purple-200/80 bg-white shadow-sm shadow-purple-100/40">
            {!details ? (
              <div className="p-6">
                <EmptyState
                  title="Choose an attendance sheet"
                  description="Select a meeting to review member statuses."
                  icon={
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3M5 11h14m-9 4l2 2 4-4M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                />
              </div>
            ) : (
              <>
                <div className="border-b border-purple-100 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">
                          {details.session.title}
                        </h2>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            details.session.is_active
                              ? "border-purple-200 bg-purple-100 text-purple-700"
                              : "border-slate-200 bg-slate-100 text-slate-500"
                          }`}
                        >
                          {details.session.is_active ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatDate(details.session.meeting_date)}
                        {details.session.event_title ? ` · ${details.session.event_title}` : ""}
                      </p>
                      {details.session.instructions && (
                        <p className="mt-3 max-w-2xl text-sm text-slate-600">
                          {details.session.instructions}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => toggleActivation(details.session)}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                          details.session.is_active
                            ? "border border-purple-200 bg-white text-purple-700 hover:bg-purple-50"
                            : "bg-purple-600 text-white hover:bg-purple-700"
                        }`}
                      >
                        {details.session.is_active ? "Pause Prompt" : "Notify Members"}
                      </button>
                      <button
                        onClick={() => openEdit(details.session)}
                        className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeSession(details.session)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Rate</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">{formatRate(selectedSessionRate)}</p>
                    </div>
                    {STATUS_OPTIONS.map((status) => (
                      <div key={status} className={`rounded-xl border px-3 py-3 ${STATUS_CONFIG[status].chip}`}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-70">
                          {STATUS_CONFIG[status].label}
                        </p>
                        <p className="mt-1 text-xl font-bold">
                          {status === "present"
                            ? details.session.present_count
                            : status === "absent"
                              ? details.session.absent_count
                              : details.session.excused_count}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Team Members</h3>
                      <p className="text-xs text-slate-500">
                        Mark Present, Absent, or Excused and keep the reason when needed.
                      </p>
                    </div>
                    {isDetailLoading && (
                      <span className="text-xs font-medium text-slate-400">Refreshing...</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {details.records.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(record.member_name)}`}>
                              {getInitials(record.member_name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900">{record.member_name}</p>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CONFIG[record.status].chip}`}>
                                  {STATUS_CONFIG[record.status].label}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {record.position || record.role} · {record.department}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {STATUS_OPTIONS.map((status) => (
                              <button
                                key={status}
                                onClick={() =>
                                  saveRecord(record, {
                                    status,
                                    reason:
                                      status === "present"
                                        ? ""
                                        : record.reason,
                                  })
                                }
                                disabled={savingRecordId === record.id}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                                  record.status === status
                                    ? STATUS_CONFIG[status].activeButton
                                    : "border-purple-100 bg-white text-slate-500 hover:bg-purple-50/70"
                                }`}
                              >
                                {STATUS_CONFIG[status].label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">
                              Reason
                            </label>
                            <input
                              value={record.reason}
                              onChange={(event) =>
                                updateLocalRecord(record.user_id, {
                                  reason: event.target.value,
                                })
                              }
                              placeholder="sick, travel, volunteering elsewhere"
                              className="w-full rounded-lg border border-purple-100 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-600">
                              Notes
                            </label>
                            <div className="flex gap-2">
                              <input
                                value={record.note}
                                onChange={(event) =>
                                  updateLocalRecord(record.user_id, {
                                    note: event.target.value,
                                  })
                                }
                                placeholder="late, called, confirmed"
                                className="min-w-0 flex-1 rounded-lg border border-purple-100 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                              />
                              <button
                                onClick={() => saveRecord(record)}
                                disabled={savingRecordId === record.id}
                                className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-700 disabled:bg-slate-300"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-purple-200/80 bg-white p-5 shadow-sm shadow-purple-100/40">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Member Attendance Rates</h2>
              <p className="text-xs text-slate-500">Review consistency across recorded meetings.</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-purple-100 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-purple-400">
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2">Present</th>
                  <th className="px-3 py-2">Absent</th>
                  <th className="px-3 py-2">Excused</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50">
                {memberStats.map((member) => (
                  <tr key={member.user_id} className="text-slate-700">
                    <td className="px-3 py-3 font-medium text-slate-900">{member.member_name}</td>
                    <td className="px-3 py-3">{member.department}</td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-36 items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-purple-500"
                            style={{ width: progressWidth(member.attendance_rate) }}
                          />
                        </div>
                        <span className="w-14 text-right text-xs font-semibold text-slate-500">
                          {formatRate(member.attendance_rate)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">{member.present_count}</td>
                    <td className="px-3 py-3">{member.absent_count}</td>
                    <td className="px-3 py-3">{member.excused_count}</td>
                  </tr>
                ))}
                {memberStats.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                      No member attendance data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingId(null);
          setForm(EMPTY_FORM);
        }}
        title={editingId ? "Edit Attendance" : "New Attendance"}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Link Event
            </label>
            <AppSelect
              value={form.eventId || "none"}
              onValueChange={(v) => selectEvent(v === "none" ? "" : v)}
              options={[
                { value: "none", label: "No linked event" },
                ...events.map((event) => ({ value: String(event.id), label: `${event.title} - ${formatDate(event.date)}` })),
              ]}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Attendance Title *
            </label>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Weekly team meeting"
              className="w-full rounded-lg border border-purple-100 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Meeting Date *
            </label>
            <input
              type="date"
              value={form.meetingDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  meetingDate: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-purple-100 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Instructions
            </label>
            <textarea
              value={form.instructions}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  instructions: event.target.value,
                }))
              }
              rows={3}
              placeholder="Please confirm if you can attend. Add a reason if not."
              className="w-full resize-none rounded-lg border border-purple-100 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-purple-100 bg-purple-50/60 px-4 py-3">
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                Notify members now
              </span>
              <span className="block text-xs text-slate-500">
                Members must respond before continuing.
              </span>
            </span>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              className="h-5 w-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
            />
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setModalOpen(false);
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
              className="rounded-lg border border-purple-200 px-4 py-2 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50"
            >
              Cancel
            </button>
            <button
              onClick={saveSession}
              disabled={savingSession || !form.title.trim() || !form.meetingDate}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:bg-slate-300"
            >
              {savingSession ? "Saving..." : editingId ? "Save Changes" : "Create Attendance"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
