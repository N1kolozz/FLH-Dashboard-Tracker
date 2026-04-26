"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { assertHeadOrAdmin } from "@/lib/permissions";
import {
  indexRowsByOwner,
  normalizeOwnerUserIds,
} from "@/lib/owner-users";
import {
  MemberContribution,
  DepartmentSummary,
  MonthlySummaryData,
} from "@/types";

interface SummaryUserRow {
  id: number;
  name: string;
  department: string;
  role: string;
  position: string;
  email: string;
}

interface SummaryProjectRow {
  id: number;
  name: string;
  description: string;
  status: string;
  priority: string;
  team: string;
  owner_user_ids: number[];
}

interface SummaryEventRow {
  id: number;
  title: string;
  date: string;
  location: string;
  department: string;
  description: string;
  owner_user_ids: number[];
}

interface SummaryImpactRow {
  id: number;
  project_id: number | null;
  project_name: string;
  activity_type: string;
  people_reached: number;
  date: string;
  result_summary: string;
}

interface SummaryAttendanceRow {
  user_id: number;
  department: string;
  recorded: number;
  present: number;
}

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

function pushByKey<K, T>(map: Map<K, T[]>, key: K, item: T) {
  const current = map.get(key);
  if (current) {
    current.push(item);
  } else {
    map.set(key, [item]);
  }
}

export async function getMonthlySummary(
  month: string
): Promise<{ success: true; data: MonthlySummaryData } | { error: string }> {
  try {
    assertHeadOrAdmin(await getSession());

    const { start, end } = monthStartEnd(month);

    const [
      usersRes,
      projectsRes,
      eventsRes,
      expensesRes,
      impactRes,
      attendanceRes,
    ] = await Promise.all([
      pool.query(
        `SELECT id, full_name AS name, department, role, COALESCE(position, '') AS position, email
         FROM users
         ORDER BY department, full_name`
      ),
      pool.query(
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
      ),
      pool.query(
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
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM expenses
         WHERE date >= $1 AND date <= $2`,
        [start, end]
      ),
      pool.query(
        `SELECT
           ir.id,
           ir.project_id,
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
      ),
      pool.query(
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
      ),
    ]);

    const users = usersRes.rows as SummaryUserRow[];
    const projects = projectsRes.rows as SummaryProjectRow[];
    const events = eventsRes.rows as SummaryEventRow[];
    const impactRecords = impactRes.rows as SummaryImpactRow[];
    const attendanceRows = attendanceRes.rows as SummaryAttendanceRow[];

    const attendanceMap = new Map<
      number,
      { recorded: number; present: number }
    >();
    for (const row of attendanceRows) {
      attendanceMap.set(row.user_id, {
        recorded: row.recorded,
        present: row.present,
      });
    }

    const userMap = new Map(users.map((user) => [user.id, user]));
    const usersByDepartment = new Map<string, SummaryUserRow[]>();
    const userDepartmentById = new Map<number, string>();

    for (const user of users) {
      pushByKey(usersByDepartment, user.department, user);
      userDepartmentById.set(user.id, user.department);
    }

    const departmentNames = Array.from(usersByDepartment.keys()).sort();
    const departmentsByLowerName = new Map(
      departmentNames.map((department) => [department.toLowerCase(), department])
    );

    const projectsByOwner = indexRowsByOwner(projects);
    const eventsByOwner = indexRowsByOwner(events);
    const projectsByDepartment = new Map<string, SummaryProjectRow[]>();
    const eventsByDepartment = new Map<string, SummaryEventRow[]>();
    const impactByProjectId = new Map<number, SummaryImpactRow[]>();

    for (const project of projects) {
      const linkedDepartments = new Set<string>();
      const projectTeam = project.team.trim().toLowerCase();

      for (const department of departmentNames) {
        const loweredDepartment = department.toLowerCase();
        if (
          projectTeam &&
          (projectTeam === loweredDepartment ||
            projectTeam.includes(loweredDepartment))
        ) {
          linkedDepartments.add(department);
        }
      }

      for (const ownerId of normalizeOwnerUserIds(project.owner_user_ids)) {
        const ownerDepartment = userDepartmentById.get(ownerId);
        if (ownerDepartment) linkedDepartments.add(ownerDepartment);
      }

      for (const department of Array.from(linkedDepartments)) {
        pushByKey(projectsByDepartment, department, project);
      }
    }

    for (const event of events) {
      const linkedDepartments = new Set<string>();
      const eventDepartment = event.department.trim().toLowerCase();

      if (eventDepartment === "all") {
        for (const department of departmentNames) {
          linkedDepartments.add(department);
        }
      } else {
        const matchedDepartment = departmentsByLowerName.get(eventDepartment);
        if (matchedDepartment) {
          linkedDepartments.add(matchedDepartment);
        }
      }

      for (const ownerId of normalizeOwnerUserIds(event.owner_user_ids)) {
        const ownerDepartment = userDepartmentById.get(ownerId);
        if (ownerDepartment) linkedDepartments.add(ownerDepartment);
      }

      for (const department of Array.from(linkedDepartments)) {
        pushByKey(eventsByDepartment, department, event);
      }
    }

    for (const record of impactRecords) {
      if (record.project_id == null) continue;
      pushByKey(impactByProjectId, record.project_id, record);
    }

    const ownerNames = (ids: number[]): string[] =>
      normalizeOwnerUserIds(ids)
        .map((id) => userMap.get(id)?.name)
        .filter(Boolean) as string[];

    const departments: DepartmentSummary[] = departmentNames.map((department) => {
      const departmentUsers = usersByDepartment.get(department) ?? [];
      const departmentProjects = projectsByDepartment.get(department) ?? [];
      const departmentEvents = eventsByDepartment.get(department) ?? [];
      const departmentImpact = departmentProjects.flatMap(
        (project) => impactByProjectId.get(project.id) ?? []
      );

      let departmentRecorded = 0;
      let departmentPresent = 0;
      for (const user of departmentUsers) {
        const attendance = attendanceMap.get(user.id);
        if (!attendance) continue;
        departmentRecorded += attendance.recorded;
        departmentPresent += attendance.present;
      }

      const members: MemberContribution[] = departmentUsers.map((user) => {
        const userProjects = projectsByOwner.get(user.id) ?? [];
        const userEvents = eventsByOwner.get(user.id) ?? [];
        const attendance = attendanceMap.get(user.id);

        return {
          id: user.id,
          name: user.name,
          department: user.department,
          position: user.position,
          role: user.role,
          projectCount: userProjects.length,
          eventCount: userEvents.length,
          attendanceRate:
            attendance && attendance.recorded > 0
              ? Math.round((attendance.present / attendance.recorded) * 100)
              : null,
          projects: userProjects.map((project) => ({
            id: project.id,
            name: project.name,
            status: project.status,
            priority: project.priority,
          })),
          events: userEvents.map((event) => ({
            id: event.id,
            title: event.title,
            date: event.date,
          })),
        };
      });

      return {
        department,
        memberCount: departmentUsers.length,
        activeProjects: departmentProjects.filter(
          (project) => project.status !== "completed"
        ).length,
        completedProjects: departmentProjects.filter(
          (project) => project.status === "completed"
        ).length,
        totalEvents: departmentEvents.length,
        totalExpenses: 0,
        attendanceRate:
          departmentRecorded > 0
            ? Math.round((departmentPresent / departmentRecorded) * 100)
            : null,
        members,
        projects: departmentProjects.map((project) => ({
          id: project.id,
          name: project.name,
          status: project.status,
          priority: project.priority,
          description: project.description || "",
          ownerNames: ownerNames(project.owner_user_ids),
        })),
        events: departmentEvents.map((event) => ({
          id: event.id,
          title: event.title,
          date: event.date,
          location: event.location || "",
          description: event.description || "",
          ownerNames: ownerNames(event.owner_user_ids),
        })),
        impactRecords: departmentImpact.map((record) => ({
          id: record.id,
          projectName: record.project_name,
          activityType: record.activity_type,
          peopleReached: record.people_reached,
          date: record.date,
          resultSummary: record.result_summary,
        })),
      };
    });

    let totalRecorded = 0;
    let totalPresent = 0;
    for (const attendance of Array.from(attendanceMap.values())) {
      totalRecorded += attendance.recorded;
      totalPresent += attendance.present;
    }

    const totalPeopleReached = impactRecords.reduce(
      (sum, record) => sum + (record.people_reached || 0),
      0
    );

    const data: MonthlySummaryData = {
      month,
      monthLabel: monthLabel(month),
      totalMembers: users.length,
      totalProjects: projects.length,
      activeProjects: projects.filter((project) => project.status !== "completed")
        .length,
      completedProjects: projects.filter((project) => project.status === "completed")
        .length,
      totalEvents: events.length,
      totalExpenses: expensesRes.rows[0]?.total || 0,
      totalPeopleReached,
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
