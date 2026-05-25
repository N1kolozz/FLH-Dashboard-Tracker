"use server";

import { pool } from "@/lib/db";
import { requireAuthenticatedSession } from "@/lib/action-auth";
import { indexRowsByOwner } from "@/lib/owner-users";
import { log } from "@/lib/logger";

export interface WorkloadMember {
  id: number;
  name: string;
  role: string;
  department: string;
  position: string;
  email: string;
  activeProjects: number;
  totalProjects: number;
  upcomingEvents: number;
  totalEvents: number;
  projectDetails: {
    id: number;
    name: string;
    status: string;
    priority: string;
    deadline: string | null;
  }[];
  eventDetails: { id: number; title: string; date: string; department: string }[];
}

interface WorkloadUserRow {
  id: number;
  name: string;
  role: string;
  department: string;
  position: string;
  email: string;
}

interface OwnedProjectRow {
  id: number;
  name: string;
  status: string;
  priority: string;
  deadline: string | null;
  owner_user_ids: number[];
}

interface OwnedEventRow {
  id: number;
  title: string;
  date: string;
  department: string;
  owner_user_ids: number[];
}

export async function getWorkloadData(): Promise<
  { success: true; members: WorkloadMember[] } | { error: string }
> {
  try {
    await requireAuthenticatedSession();
    const usersRes = await pool.query(
      `SELECT id, full_name AS name, role, department, position, email
       FROM users
       WHERE role != 'ADMIN'
       ORDER BY full_name ASC`
    );
    const users = usersRes.rows as WorkloadUserRow[];

    if (users.length === 0) return { success: true, members: [] };

    const [
      activeProjectsRes,
      allProjectsRes,
      upcomingEventsRes,
      allEventsRes,
    ] = await Promise.all([
      pool.query(
        `SELECT
           p.id,
           p.name,
           p.status,
           p.priority,
           p.deadline::text,
           COALESCE(
             NULLIF(p.owner_user_ids, '{}'),
             CASE WHEN p.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[p.owner_user_id] END
           ) AS owner_user_ids
         FROM projects p
         WHERE p.status != 'completed'
         ORDER BY p.created_at DESC`
      ),
      pool.query(
        `SELECT
           p.id,
           p.name,
           p.status,
           p.priority,
           p.deadline::text,
           COALESCE(
             NULLIF(p.owner_user_ids, '{}'),
             CASE WHEN p.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[p.owner_user_id] END
           ) AS owner_user_ids
         FROM projects p
         ORDER BY p.created_at DESC`
      ),
      pool.query(
        `SELECT
           e.id,
           e.title,
           e.date::text,
           e.department,
           COALESCE(
             NULLIF(e.owner_user_ids, '{}'),
             CASE WHEN e.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[e.owner_user_id] END
           ) AS owner_user_ids
         FROM events e
         WHERE e.date >= CURRENT_DATE AND e.date <= CURRENT_DATE + INTERVAL '90 days'
         ORDER BY e.date ASC`
      ),
      pool.query(
        `SELECT
           e.id,
           e.title,
           e.date::text,
           e.department,
           COALESCE(
             NULLIF(e.owner_user_ids, '{}'),
             CASE WHEN e.owner_user_id IS NULL THEN '{}'::INTEGER[] ELSE ARRAY[e.owner_user_id] END
           ) AS owner_user_ids
         FROM events e
         ORDER BY e.date DESC`
      ),
    ]);

    const activeProjects = activeProjectsRes.rows as OwnedProjectRow[];
    const allProjects = allProjectsRes.rows as OwnedProjectRow[];
    const upcomingEvents = upcomingEventsRes.rows as OwnedEventRow[];
    const allEvents = allEventsRes.rows as OwnedEventRow[];

    const activeProjectsByOwner = indexRowsByOwner(activeProjects);
    const allProjectsByOwner = indexRowsByOwner(allProjects);
    const upcomingEventsByOwner = indexRowsByOwner(upcomingEvents);
    const allEventsByOwner = indexRowsByOwner(allEvents);

    const members: WorkloadMember[] = users.map((user) => {
      const myActiveProjects = activeProjectsByOwner.get(user.id) ?? [];
      const myTotalProjects = allProjectsByOwner.get(user.id) ?? [];
      const myUpcomingEvents = upcomingEventsByOwner.get(user.id) ?? [];
      const myAllEvents = allEventsByOwner.get(user.id) ?? [];

      return {
        id: user.id,
        name: user.name,
        role: user.role,
        department: user.department,
        position: user.position,
        email: user.email,
        activeProjects: myActiveProjects.length,
        totalProjects: myTotalProjects.length,
        upcomingEvents: myUpcomingEvents.length,
        totalEvents: myAllEvents.length,
        projectDetails: myActiveProjects.map((project) => ({
          id: project.id,
          name: project.name,
          status: project.status,
          priority: project.priority,
          deadline: project.deadline,
        })),
        eventDetails: myUpcomingEvents.slice(0, 5).map((event) => ({
          id: event.id,
          title: event.title,
          date: event.date,
          department: event.department,
        })),
      };
    });

    return { success: true, members };
  } catch (error) {
    log.error("Error fetching workload data", error);
    return { error: "Failed to fetch workload data" };
  }
}
