export type AttendanceStatus = "pending" | "present" | "absent" | "excused";

export interface AttendanceSessionRow {
  id: number;
  event_id: number | null;
  event_title: string | null;
  event_date: string | null;
  title: string;
  meeting_date: string;
  instructions: string;
  is_active: boolean;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
  total_members: number;
  pending_count: number;
  present_count: number;
  absent_count: number;
  excused_count: number;
}

export interface AttendanceRecordRow {
  id: number;
  session_id: number;
  user_id: number;
  member_name: string;
  member_email: string;
  department: string;
  position: string;
  role: string;
  status: AttendanceStatus;
  note: string;
  reason: string;
  responded_at: string | null;
  updated_at: string;
}

export interface AttendancePromptRow {
  session_id: number;
  title: string;
  meeting_date: string;
  instructions: string;
  event_title: string | null;
  event_date: string | null;
  event_time: string | null;
  event_end_time: string | null;
  event_location: string | null;
}

export interface MemberAttendanceStat {
  user_id: number;
  member_name: string;
  department: string;
  recorded_count: number;
  present_count: number;
  absent_count: number;
  excused_count: number;
  attendance_rate: number | null;
}

export interface DepartmentAttendanceStat {
  department: string;
  recorded_count: number;
  present_count: number;
  absent_count: number;
  excused_count: number;
  attendance_rate: number | null;
}

export interface AttendanceStats {
  session_count: number;
  active_session_count: number;
  recorded_count: number;
  present_count: number;
  absent_count: number;
  excused_count: number;
  pending_count: number;
  average_attendance_rate: number | null;
  member_stats: MemberAttendanceStat[];
  department_stats: DepartmentAttendanceStat[];
}

export interface ProjectRow {
  id: number;
  name: string;
  description: string;
  status: string;
  priority: string;
  deadline: string | null;
  team: string;
  tags: string[];
  owner_user_ids: number[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MemberContribution {
  id: number;
  name: string;
  department: string;
  position: string;
  role: string;
  projectCount: number;
  eventCount: number;
  attendanceRate: number | null;
  projects: { id: number; name: string; status: string; priority: string }[];
  events: { id: number; title: string; date: string }[];
}

export interface DepartmentSummary {
  department: string;
  memberCount: number;
  activeProjects: number;
  completedProjects: number;
  totalEvents: number;
  totalExpenses: number;
  attendanceRate: number | null;
  members: MemberContribution[];
  projects: {
    id: number;
    name: string;
    status: string;
    priority: string;
    description: string;
    ownerNames: string[];
  }[];
  events: {
    id: number;
    title: string;
    date: string;
    location: string;
    description: string;
    ownerNames: string[];
  }[];
  impactRecords: {
    id: number;
    projectName: string;
    activityType: string;
    peopleReached: number;
    date: string;
    resultSummary: string;
  }[];
}

export interface MonthlySummaryData {
  month: string; // YYYY-MM
  monthLabel: string;
  totalMembers: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalEvents: number;
  totalExpenses: number;
  totalPeopleReached: number;
  overallAttendanceRate: number | null;
  departments: DepartmentSummary[];
}
