"use server";

import { pool } from "@/lib/db";

export interface WorkloadMember {
  id: number;
  name: string;
  role: string;
  department: string;
  position: string;
  email: string;
  // counts
  activeProjects: number;
  totalProjects: number;
  upcomingEvents: number;
  totalEvents: number;
  // breakdown
  projectDetails: { id: number; name: string; status: string; priority: string; deadline: string | null }[];
  eventDetails: { id: number; title: string; date: string; department: string }[];
}

export async function getWorkloadData(): Promise<{ success: true; members: WorkloadMember[] } | { error: string }> {
  try {
    // Fetch all users
    const usersRes = await pool.query(
      `SELECT id, full_name AS name, role, department, position, email
       FROM users
       ORDER BY full_name ASC`
    );
    const users = usersRes.rows as { id: number; name: string; role: string; department: string; position: string; email: string }[];

    if (users.length === 0) return { success: true, members: [] };

    // Fetch all projects with owner_user_ids
    const projectsRes = await pool.query(
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
    );

    // Fetch all projects (including completed) for total count
    const allProjectsRes = await pool.query(
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
    );

    // Fetch upcoming events (next 90 days)
    const eventsRes = await pool.query(
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
    );

    // Fetch all events for total count
    const allEventsRes = await pool.query(
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
    );

    const activeProjects = projectsRes.rows;
    const allProjects = allProjectsRes.rows;
    const upcomingEvents = eventsRes.rows;
    const allEvents = allEventsRes.rows;

    const members: WorkloadMember[] = users.map((user) => {
      const myActiveProjects = activeProjects.filter((p) =>
        Array.isArray(p.owner_user_ids) && p.owner_user_ids.includes(user.id)
      );
      const myTotalProjects = allProjects.filter((p) =>
        Array.isArray(p.owner_user_ids) && p.owner_user_ids.includes(user.id)
      );
      const myUpcomingEvents = upcomingEvents.filter((e) =>
        Array.isArray(e.owner_user_ids) && e.owner_user_ids.includes(user.id)
      );
      const myAllEvents = allEvents.filter((e) =>
        Array.isArray(e.owner_user_ids) && e.owner_user_ids.includes(user.id)
      );

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
        projectDetails: myActiveProjects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          priority: p.priority,
          deadline: p.deadline,
        })),
        eventDetails: myUpcomingEvents.slice(0, 5).map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          department: e.department,
        })),
      };
    });

    return { success: true, members };
  } catch (error) {
    console.error("Error fetching workload data:", error);
    return { error: "Failed to fetch workload data" };
  }
}
