"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";

/* ─── Types ─── */

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

/* ─── Helpers ─── */

function monthStartEnd(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
  const end = new Date(y, m, 0).toISOString().slice(0, 10);
  return { start, end };
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/* ─── Main action ─── */

export async function getMonthlySummary(
  month: string
): Promise<{ success: true; data: MonthlySummaryData } | { error: string }> {
  try {
    const session = await getSession();
    if (!session || session.role !== "HEAD") {
      return { error: "Not authorized — HEAD role only" };
    }

    const { start, end } = monthStartEnd(month);

    // 1. Fetch all members
    const usersRes = await pool.query(
      `SELECT id, full_name AS name, department, role, COALESCE(position, '') AS position, email
       FROM users ORDER BY department, full_name`
    );
    const users = usersRes.rows as {
      id: number;
      name: string;
      department: string;
      role: string;
      position: string;
      email: string;
    }[];

    // 2. Projects that were active / created / completed in the month
    const projectsRes = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.description,
         p.status,
         p.priority,
         p.team,
         COALESCE(
           NULLIF(p.owner_user_ids, '{}'),
           CASE WHEN p.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[p.owner_user_id] END
         ) AS owner_user_ids
       FROM projects p
       WHERE p.created_at::date <= $2
         AND (p.status != 'completed' OR p.updated_at::date >= $1)
       ORDER BY p.created_at DESC`,
      [start, end]
    );

    // 3. Events in the month
    const eventsRes = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.date::text,
         e.location,
         e.department,
         e.description,
         COALESCE(
           NULLIF(e.owner_user_ids, '{}'),
           CASE WHEN e.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[e.owner_user_id] END
         ) AS owner_user_ids
       FROM events e
       WHERE e.date >= $1 AND e.date <= $2
       ORDER BY e.date ASC`,
      [start, end]
    );

    // 4. Expenses in the month
    const expensesRes = await pool.query(
      `SELECT
         COALESCE(SUM(amount), 0)::float AS total
       FROM expenses
       WHERE date >= $1 AND date <= $2`,
      [start, end]
    );

    // 5. Impact records in the month
    const impactRes = await pool.query(
      `SELECT
         ir.id,
         COALESCE(p.name, ir.project_name) AS project_name,
         ir.activity_type,
         ir.people_reached,
         ir.date::text,
         COALESCE(ir.result_summary, '') AS result_summary
       FROM impact_records ir
       LEFT JOIN projects p ON p.id = ir.project_id
       WHERE ir.date >= $1 AND ir.date <= $2
       ORDER BY ir.date DESC`,
      [start, end]
    );

    // 6. Attendance data for the month
    const attendanceRes = await pool.query(
      `SELECT
         u.id AS user_id,
         u.department,
         COUNT(r.id) FILTER (WHERE r.status <> 'pending')::int AS recorded,
         COUNT(r.id) FILTER (WHERE r.status = 'present')::int AS present
       FROM users u
       LEFT JOIN attendance_records r ON r.user_id = u.id
       LEFT JOIN attendance_sessions s ON s.id = r.session_id
         AND s.meeting_date >= $1 AND s.meeting_date <= $2
       WHERE s.id IS NOT NULL
       GROUP BY u.id, u.department`,
      [start, end]
    );

    const attendanceMap = new Map<
      number,
      { recorded: number; present: number }
    >();
    for (const row of attendanceRes.rows) {
      attendanceMap.set(row.user_id, {
        recorded: row.recorded,
        present: row.present,
      });
    }

    // Build user lookup
    const userMap = new Map(users.map((u) => [u.id, u]));

    const ownerNames = (ids: number[]): string[] => {
      return (ids || [])
        .map((id) => userMap.get(id)?.name)
        .filter(Boolean) as string[];
    };

    // Build department breakdown
    const deptNames = Array.from(new Set(users.map((u) => u.department))).sort();

    const departments: DepartmentSummary[] = deptNames.map((dept) => {
      const deptUsers = users.filter((u) => u.department === dept);
      const deptUserIds = new Set(deptUsers.map((u) => u.id));

      // Projects where at least one owner is from this dept, or team matches
      const deptProjects = projectsRes.rows.filter((p) => {
        const team = (p.team || "").toLowerCase();
        const deptLC = dept.toLowerCase();
        if (team === deptLC || team.includes(deptLC)) return true;
        return (
          Array.isArray(p.owner_user_ids) &&
          p.owner_user_ids.some((id: number) => deptUserIds.has(id))
        );
      });

      // Events where department matches or owners in dept
      const deptEvents = eventsRes.rows.filter((e) => {
        const edept = (e.department || "").toLowerCase();
        if (edept === "all" || edept === dept.toLowerCase()) return true;
        return (
          Array.isArray(e.owner_user_ids) &&
          e.owner_user_ids.some((id: number) => deptUserIds.has(id))
        );
      });

      // Impact records for department projects
      const deptProjectIds = new Set(deptProjects.map((p) => p.id));
      const deptImpact = impactRes.rows.filter((ir) =>
        deptProjectIds.has(ir.project_id)
      );

      // Attendance for dept
      let deptRecorded = 0;
      let deptPresent = 0;
      for (const u of deptUsers) {
        const a = attendanceMap.get(u.id);
        if (a) {
          deptRecorded += a.recorded;
          deptPresent += a.present;
        }
      }

      // Members list
      const members: MemberContribution[] = deptUsers.map((u) => {
        const userProjects = deptProjects.filter(
          (p) =>
            Array.isArray(p.owner_user_ids) && p.owner_user_ids.includes(u.id)
        );
        const userEvents = deptEvents.filter(
          (e) =>
            Array.isArray(e.owner_user_ids) && e.owner_user_ids.includes(u.id)
        );
        const att = attendanceMap.get(u.id);

        return {
          id: u.id,
          name: u.name,
          department: u.department,
          position: u.position,
          role: u.role,
          projectCount: userProjects.length,
          eventCount: userEvents.length,
          attendanceRate:
            att && att.recorded > 0
              ? Math.round((att.present / att.recorded) * 100)
              : null,
          projects: userProjects.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            priority: p.priority,
          })),
          events: userEvents.map((e) => ({
            id: e.id,
            title: e.title,
            date: e.date,
          })),
        };
      });

      return {
        department: dept,
        memberCount: deptUsers.length,
        activeProjects: deptProjects.filter((p) => p.status !== "completed")
          .length,
        completedProjects: deptProjects.filter((p) => p.status === "completed")
          .length,
        totalEvents: deptEvents.length,
        totalExpenses: 0, // expenses are not department-keyed
        attendanceRate:
          deptRecorded > 0
            ? Math.round((deptPresent / deptRecorded) * 100)
            : null,
        members,
        projects: deptProjects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          priority: p.priority,
          description: p.description || "",
          ownerNames: ownerNames(p.owner_user_ids),
        })),
        events: deptEvents.map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          location: e.location || "",
          description: e.description || "",
          ownerNames: ownerNames(e.owner_user_ids),
        })),
        impactRecords: deptImpact.map((ir) => ({
          id: ir.id,
          projectName: ir.project_name,
          activityType: ir.activity_type,
          peopleReached: ir.people_reached,
          date: ir.date,
          resultSummary: ir.result_summary,
        })),
      };
    });

    // Overall totals
    let totalRecorded = 0;
    let totalPresent = 0;
    for (const a of Array.from(attendanceMap.values())) {
      totalRecorded += a.recorded;
      totalPresent += a.present;
    }

    const data: MonthlySummaryData = {
      month,
      monthLabel: monthLabel(month),
      totalMembers: users.length,
      totalProjects: projectsRes.rows.length,
      activeProjects: projectsRes.rows.filter((p) => p.status !== "completed")
        .length,
      completedProjects: projectsRes.rows.filter(
        (p) => p.status === "completed"
      ).length,
      totalEvents: eventsRes.rows.length,
      totalExpenses: expensesRes.rows[0]?.total || 0,
      totalPeopleReached: impactRes.rows.reduce(
        (sum: number, r: { people_reached: number }) =>
          sum + (r.people_reached || 0),
        0
      ),
      overallAttendanceRate:
        totalRecorded > 0
          ? Math.round((totalPresent / totalRecorded) * 100)
          : null,
      departments,
    };

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching monthly summary:", error);
    return { error: "Failed to fetch monthly summary" };
  }
}
