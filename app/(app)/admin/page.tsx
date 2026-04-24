import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import { Icons } from "@/components/Icons";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

function getDeviceType(userAgent: string) {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();
  if (/(android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini)/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

const tbilisiFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Asia/Tbilisi",
});

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/social": "Social Analytics",
  "/social/calendar": "Content Calendar",
  "/projects/overview": "Projects Overview",
  "/projects": "Project Board",
  "/projects/impact": "Project Outcomes",
  "/logistics/inventory": "Inventory",
  "/logistics/expenses": "Expenses",
  "/events": "Events",
  "/attendance": "Attendance",
  "/team": "Team Directory",
  "/team/workload": "Workload View",
  "/summary": "Summary",
};

function getPageLabel(path: string) {
  return PAGE_LABELS[path] || path;
}

export default async function AdminPanelPage() {
  const session = await getSession();
  
  if (!session || session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // ── Data Fetching (parallel) ──────────────────────────────────────

  const [
    recentActivitiesRes,
    activeSessionsRes,
    statsRes,
    topPagesRes,
    mostActiveUsersRes,
    inactiveUsersRes,
  ] = await Promise.all([
    // Recent activities
    pool.query(`
      SELECT a.id, a.action, a.path, a.created_at AT TIME ZONE 'UTC' as created_at, u.full_name, u.email
      FROM user_activities a
      JOIN users u ON a.user_id = u.id
      WHERE u.role != 'ADMIN'
      ORDER BY a.created_at DESC
      LIMIT 50
    `),
    // Active sessions today
    pool.query(`
      SELECT s.id, s.start_time AT TIME ZONE 'UTC' as start_time, s.last_ping AT TIME ZONE 'UTC' as last_ping,
             s.duration_seconds, s.ip_address, s.user_agent, u.full_name, u.email, s.is_active
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.start_time >= CURRENT_DATE AND u.role != 'ADMIN'
      ORDER BY s.last_ping DESC
      LIMIT 50
    `),
    // Stats
    pool.query(`
      SELECT 
        (SELECT COUNT(DISTINCT s.user_id) FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.start_time >= CURRENT_DATE AND u.role != 'ADMIN') as active_users_today,
        (SELECT COUNT(a.*) FROM user_activities a JOIN users u ON a.user_id = u.id WHERE a.created_at >= CURRENT_DATE AND u.role != 'ADMIN') as total_actions_today,
        (SELECT COUNT(*) FROM users WHERE role != 'ADMIN') as total_users
    `),
    // Most visited pages (last 7 days)
    pool.query(`
      SELECT a.path, COUNT(*) as visit_count
      FROM user_activities a
      JOIN users u ON a.user_id = u.id
      WHERE a.action = 'page_view'
        AND a.created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND u.role != 'ADMIN'
        AND a.path IS NOT NULL AND a.path != ''
      GROUP BY a.path
      ORDER BY visit_count DESC
      LIMIT 8
    `),
    // Most active users (last 7 days)
    pool.query(`
      SELECT u.full_name, u.email, u.department, COUNT(a.*) as action_count,
             MAX(a.created_at) AT TIME ZONE 'UTC' as last_seen
      FROM user_activities a
      JOIN users u ON a.user_id = u.id
      WHERE a.created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND u.role != 'ADMIN'
      GROUP BY u.id, u.full_name, u.email, u.department
      ORDER BY action_count DESC
      LIMIT 10
    `),
    // Inactive users (no activity in last 7 days)
    pool.query(`
      SELECT u.id, u.full_name, u.email, u.department, u.role,
             MAX(a.created_at) AT TIME ZONE 'UTC' as last_activity
      FROM users u
      LEFT JOIN user_activities a ON a.user_id = u.id
      WHERE u.role != 'ADMIN'
      GROUP BY u.id, u.full_name, u.email, u.department, u.role
      HAVING MAX(a.created_at) IS NULL OR MAX(a.created_at) < CURRENT_DATE - INTERVAL '7 days'
      ORDER BY last_activity ASC NULLS FIRST
    `),
  ]);

  const activities = recentActivitiesRes.rows;
  const sessions = activeSessionsRes.rows;
  const stats = statsRes.rows[0];
  const topPages = topPagesRes.rows;
  const mostActiveUsers = mostActiveUsersRes.rows;
  const inactiveUsers = inactiveUsersRes.rows;

  // Top page max for bar width
  const maxPageVisits = topPages.length > 0 ? Number(topPages[0].visit_count) : 1;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <AutoRefresh interval={5000} />

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-slate-500">Monitor platform usage and user activity in real-time.</p>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
            {Icons.team}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Users Today</p>
            <p className="text-2xl font-bold text-slate-800">{stats.active_users_today}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
            {Icons.chart}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Actions Logged Today</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total_actions_today}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Inactive Users (7d)</p>
            <p className="text-2xl font-bold text-slate-800">{inactiveUsers.length}</p>
          </div>
        </div>
      </div>

      {/* ── Row 1: Sessions + Activity Log ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sessions Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[500px]">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-semibold text-slate-800">Live Sessions</h2>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium">Duration</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="text-slate-400" title={getDeviceType(s.user_agent) === "mobile" ? "Mobile" : "Desktop"}>
                          {getDeviceType(s.user_agent) === "mobile" ? Icons.mobile : Icons.desktop}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{s.full_name}</p>
                          <p className="text-[10px] text-slate-400">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {Math.floor(s.duration_seconds / 60)}m {s.duration_seconds % 60}s
                    </td>
                    <td className="px-6 py-3">
                      {s.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-100 text-green-700 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                          Ended
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                      No sessions today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[500px]">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-semibold text-slate-800">Activity Log</h2>
          </div>
          <div className="flex-1 overflow-auto p-6 space-y-6">
            {activities.length === 0 ? (
              <div className="text-center text-slate-500 mt-10">No activities recorded yet.</div>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-[-24px] last:before:hidden before:w-px before:bg-slate-200">
                  <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white border-2 border-purple-200 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm">
                      <span className="font-semibold text-slate-800">{a.full_name}</span>{" "}
                      <span className="text-slate-500">
                        {a.action === "page_view" ? "viewed page" : "performed"}
                      </span>{" "}
                      <span className="font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                        {a.path || a.action}
                      </span>
                    </p>
                    <span className="text-xs text-slate-400">
                      {tbilisiFormatter.format(new Date(a.created_at))}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Top Pages ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-8">
        {/* Most Visited Pages */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Most Visited Pages</h2>
            <span className="text-xs text-slate-400">Last 7 days</span>
          </div>
          <div className="p-6 space-y-3">
            {topPages.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No page views yet.</p>
            ) : (
              topPages.map((p, i) => (
                <div key={p.path} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-slate-700 truncate">{getPageLabel(p.path)}</p>
                      <span className="text-xs text-slate-500 ml-2 shrink-0">{p.visit_count} views</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-violet-400 rounded-full transition-all duration-500"
                        style={{ width: `${(Number(p.visit_count) / maxPageVisits) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Most Active Users + Inactive Users ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Most Active Users */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Most Active Users</h2>
            <span className="text-xs text-slate-400">Last 7 days</span>
          </div>
          <div className="divide-y divide-slate-100">
            {mostActiveUsers.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No activity data yet.</p>
            ) : (
              mostActiveUsers.map((u, i) => (
                <div key={u.email} className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? "bg-amber-100 text-amber-700" :
                    i === 1 ? "bg-slate-200 text-slate-600" :
                    i === 2 ? "bg-orange-100 text-orange-600" :
                    "bg-slate-100 text-slate-500"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{u.full_name}</p>
                    <p className="text-[10px] text-slate-400">{u.department}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-700">{u.action_count}</p>
                    <p className="text-[10px] text-slate-400">actions</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inactive Users */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Inactive Users</h2>
            <span className="text-xs text-slate-400">No activity for 7+ days</span>
          </div>
          <div className="divide-y divide-slate-100">
            {inactiveUsers.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-green-600 font-medium">🎉 All users are active!</p>
                <p className="text-xs text-slate-400 mt-1">Everyone has used the platform in the last 7 days.</p>
              </div>
            ) : (
              inactiveUsers.map((u) => (
                <div key={u.id} className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{u.full_name}</p>
                    <p className="text-[10px] text-slate-400">{u.department} · {u.role}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">
                      {u.last_activity
                        ? tbilisiFormatter.format(new Date(u.last_activity))
                        : "Never"}
                    </p>
                    <p className="text-[10px] text-red-400">
                      {u.last_activity
                        ? `${Math.floor((Date.now() - new Date(u.last_activity).getTime()) / 86400000)}d ago`
                        : "No activity"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
