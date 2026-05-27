// Shared between server (token mint + tool dispatcher) and client (declares tools
// to the Live API when opening a session). Keep this file framework-free so it
// can be imported from both "use server" modules and client components.

import type { RoleLevel } from "./util";

export const VOICE_ASSISTANT_MODEL = "gemini-3.1-flash-live-preview";
export const VOICE_ASSISTANT_API_VERSION = "v1alpha";

// ── System instruction ────────────────────────────────────────────────────

// Static Georgian rules. Same on every session, never mentions data.
const STATIC_RULES = `შენ ხარ FLHUB-ის ხმოვანი ასისტენტი — ქართული ღონისძიებების სააგენტოს შიდა პლატფორმის თანაშემწე. \
ლაპარაკობ მხოლოდ ქართულად, თბილი და ბუნებრივი ენით, ლაკონურად — ერთი-ორი წინადადება უმეტეს შემთხვევაში.

რას აკეთებ:
1. ეხმარები გუნდის წევრებს დაშბორდის ფუნქციონალის გაგებაში (პროექტები, ღონისძიებები, აქტენდენსი, კონტენტი, ინვენტარი, ხარჯები, სოციალური მედია).
2. პასუხობ შეკითხვებზე მონაცემების შესახებ — გამოიყენე ხელმისაწვდომი ფუნქციები (tools) რათა მიიღო ცოცხალი ინფორმაცია მონაცემთა ბაზიდან.
3. არ ცდილობ მონაცემების შეცვლას, წაშლას ან დამატებას — მხოლოდ კითხვა და კონსულტაცია.

წესები:
- ყოველთვის ქართულად. თუ მომხმარებელი ინგლისურად დაგელაპარაკება, მაინც უპასუხე ქართულად.
- არ გამოიყენო რიცხვები ციფრებით (მაგ. "5") — დაწერე სიტყვით ("ხუთი"), ისე რომ ხმოვანი სინთეზი ბუნებრივად წაიკითხოს.
- სანამ tool-ს გამოიძახებ, თქვი მოკლე შემავსებელი ფრაზა (მაგ. "ერთი წუთით..."), რათა მომხმარებელმა იცოდეს, რომ ვცდილობ.
- თუ ფუნქცია უბრუნებს ცარიელ შედეგს, თქვი ბუნებრივად რომ ჯერ ამ ტიპის მონაცემი არ არის.
- თუ ფუნქცია უბრუნებს { error: "FORBIDDEN" }, ეს ნიშნავს რომ მომხმარებელს არ აქვს უფლება ამ ინფორმაციის ნახვისთვის. თავაზიანად აუხსენი, რომ ეს ფუნქცია მხოლოდ HEAD ან ADMIN როლის მქონე მომხმარებლებისთვისაა.
- თუ შენ ვერ პოულობ შესაბამის tool-ს მოთხოვნისთვის, თქვი რომ ეს ინფორმაცია ხელმისაწვდომი არ არის, და ჰკითხე, რომ შესთავაზო რაიმე სხვა.
- არასოდეს გაამხილო კონფიდენციალური ინფორმაცია (პაროლები, ტოკენები).
- გრძელი სიების ნაცვლად ჯერ მოკლე შეჯამება გააკეთე და ჰკითხე მომხმარებელს, სურს თუ არა დეტალები.`;

interface SessionContext {
  fullName: string;
  role: string;
  department: string;
}

function roleTierLabel(role: string): string {
  const r = role.toUpperCase();
  if (r === "ADMIN") return "ADMIN — სრული წვდომა";
  if (r === "HEAD") return "HEAD — სრული წვდომა";
  return "MEMBER — შეზღუდული წვდომა";
}

// Per-session prelude. Contains only the caller's identity — not data.
export function buildVoiceAssistantSystemInstruction(ctx: SessionContext): string {
  const firstName = ctx.fullName.split(/\s+/)[0] || ctx.fullName;
  const isPrivileged = ["ADMIN", "HEAD"].includes(ctx.role.toUpperCase());

  const accessNote = isPrivileged
    ? "მომხმარებელს აქვს სრული წვდომა ყველა ფუნქციაზე."
    : "მომხმარებელს არ აქვს წვდომა შემდეგ ფუნქციებზე: workload-ის შეჯამება, აქტენდენსის სტატისტიკა, განხილვის რიგი (pending approvals). თუ ამ ფუნქციებზე გკითხავს, აუხსენი რომ ეს HEAD ან ADMIN-ის უფლებაა.";

  return `${STATIC_RULES}

=== SESSION CONTEXT ===
მომხმარებლის სახელი: ${firstName} (სრული: ${ctx.fullName})
როლი: ${roleTierLabel(ctx.role)}
დეპარტამენტი: ${ctx.department}

${accessNote}

დაიწყე მისალმებით სახელით ("გამარჯობა ${firstName}"), როცა საუბარი იწყება.`;
}

// ── Tool declarations ─────────────────────────────────────────────────────
//
// `requires` is consumed by the server dispatcher to pick a role-check
// helper. It is STRIPPED before the array is sent to Gemini — unknown fields
// on FunctionDeclaration are rejected. Use `toFunctionDeclarations()`.

export interface VoiceAssistantToolDecl {
  readonly name: string;
  readonly description: string;
  readonly requires: RoleLevel;
  readonly parametersJsonSchema: Record<string, unknown>;
}

export const VOICE_ASSISTANT_TOOLS = [
  // ─── Existing 8 tools ──────────────────────────────────────────────────
  {
    name: "getDashboardOverview",
    description:
      "Use when the user asks 'what's happening', 'give me a snapshot', or wants a general status. Returns: total projects, active projects, upcoming events count, total team members, today's date (counts only, no row dumps).",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "getUpcomingEvents",
    description:
      "Use when the user asks 'what events are coming up' or 'events this week'. Returns: title, date, time, location, department for up to 20 events in the next N days (default 7, max 30).",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        daysAhead: { type: "integer", description: "Days ahead to search. Default 7, max 30." },
      },
      required: [],
    },
  },
  {
    name: "getProjectsSummary",
    description:
      "Use when the user asks about overall project counts or in-progress work. Returns: counts grouped by status (planning, in_progress, review, completed) and up to 8 in-progress project names with priority + deadline.",
    requires: "any",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getMyAssignments",
    description:
      "Use when the user asks 'what do I have', 'my tasks', 'my projects'. Returns: the current user's assigned projects (up to 10), upcoming events they own (up to 10), and pending content posts (up to 10).",
    requires: "any",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getSocialStats",
    description:
      "Use when the user asks about Instagram, TikTok, or Facebook follower counts and growth. Returns: latest followers + daily/weekly/monthly growth for each platform.",
    requires: "any",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getTeamRoster",
    description:
      "Use when the user asks for the team list or members in a department. Returns: name, role, department, position for each member. Optionally filter by department.",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        department: { type: "string", description: "Optional department filter (e.g. 'Management', 'Projects', 'PR & Social')." },
      },
      required: [],
    },
  },
  {
    name: "searchProjects",
    description:
      "Use when the user mentions a specific project name and you need to locate it. Searches projects by partial name (case-insensitive). Returns: up to 5 matches with status, priority, deadline, and owner names.",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Substring (min 3 chars) of the project name." },
      },
      required: ["query"],
    },
  },
  {
    name: "getDashboardNavigationHelp",
    description:
      "Use when the user asks 'how do I…' or 'where do I find…' about the dashboard itself. Returns: a list of every dashboard page with a brief description and usage tips. Use this BEFORE inventing answers about UI.",
    requires: "any",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },

  // ─── New Tier 1 ────────────────────────────────────────────────────────
  {
    name: "getTodaysBriefing",
    description:
      "Use when the user asks 'read me today's briefing' or 'what's the daily summary'. Returns: today's AI-generated daily briefing text (Georgian).",
    requires: "any",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getMyToday",
    description:
      "Use when the user asks 'what should I focus on today', 'what's on my plate', or 'my schedule'. Returns: a unified view of the current user's events today, project deadlines this week, and any pending attendance responses. Combines multiple data sources — call this first for 'today' questions.",
    requires: "any",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getPendingAttendance",
    description:
      "Use when the user asks 'do I need to confirm any meeting', 'any attendance pending', or 'do I have a meeting response to send'. Returns: the single most recent active attendance session awaiting the user's response (title, meeting date, instructions, linked event details) — or null if none.",
    requires: "any",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getEventDetails",
    description:
      "Use when the user asks about a specific event by name (e.g. 'when is the kickoff', 'where is the showcase'). Returns: full details for the best matching event — title, date, time, location, department, owners, and attendance counts (present/absent/pending).",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Substring (min 3 chars) of the event title." },
      },
      required: ["query"],
    },
  },
  {
    name: "getMemberInfo",
    description:
      "Use when the user asks about a specific colleague — their role, department, position, phone, or email. Returns: directory info for the best matching member. Phone and email ARE included for everyone (this is internal directory data).",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Substring (min 3 chars) of the member's name." },
      },
      required: ["name"],
    },
  },
  {
    name: "getInventoryStatus",
    description:
      "Use when the user asks 'where is the camera', 'is X available', 'who has the tripod'. Returns: up to 10 matching inventory items with status, location, condition, and current checkout (if any).",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional substring (min 3 chars) of the item name. Omit to list recently active items." },
      },
      required: [],
    },
  },

  // ─── New Tier 2 ────────────────────────────────────────────────────────
  {
    name: "getProjectDetails",
    description:
      "Use when the user wants drill-down on a specific project (status, owners, deadline, impact records, review status). Returns: full details for the best matching project. For broad listings use getProjectsSummary or searchProjects first.",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Substring (min 3 chars) of the project name." },
      },
      required: ["name"],
    },
  },
  {
    name: "getContentCalendar",
    description:
      "Use when the user asks about scheduled social media posts, the content calendar, or upcoming Instagram/TikTok/Facebook posts. Returns: up to 20 scheduled posts in the next N days (default 7) with platform, date, time, caption preview.",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        daysAhead: { type: "integer", description: "Days ahead to search. Default 7, max 30." },
      },
      required: [],
    },
  },
  {
    name: "getMonthlySpending",
    description:
      "Use when the user asks 'how much did we spend this month', 'expenses on X', 'budget for category Y'. Returns: total spending for the current Tbilisi month, top categories breakdown. Optionally filter by category.",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional category filter (e.g. 'equipment', 'travel')." },
      },
      required: [],
    },
  },
  {
    name: "getRecentImpact",
    description:
      "Use when the user asks 'how many people have we reached', 'what did we accomplish last quarter', or 'our impact'. Returns: total people reached across all impact records in the last N months (default 3), broken down by activity type.",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        months: { type: "integer", description: "Months back to aggregate. Default 3, max 12." },
      },
      required: [],
    },
  },
  {
    name: "getDeadlinesThisWeek",
    description:
      "Use when the user asks 'what's due this week', 'any deadlines coming up', or 'critical dates'. Returns: a unified list of project deadlines, event dates, and scheduled content posts falling in the next 7 days (max 15 items).",
    requires: "any",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },

  // ─── New Tier 3 ────────────────────────────────────────────────────────
  {
    name: "getOverdueProjects",
    description:
      "Use when the user asks 'what's overdue', 'late projects', 'past deadline'. Returns: up to 10 projects whose deadline has passed and status is not completed or rejected.",
    requires: "any",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getMemberAttendanceRate",
    description:
      "Use when the user asks 'how am I doing with attendance', 'my attendance rate', 'how many meetings did I attend'. Returns: the CURRENT USER's attendance stats (present count, absent count, total responses, rate %). Cannot look up other members' rates.",
    requires: "any",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getLatestNews",
    description:
      "Use when the user asks 'any news', 'recent announcements', 'what's new on the dashboard'. Returns: the latest N news posts (default 5, max 10) — title, body preview, created date.",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        n: { type: "integer", description: "How many recent news posts to return. Default 5, max 10." },
      },
      required: [],
    },
  },
  {
    name: "getCheckoutHistory",
    description:
      "Use when the user asks 'who took the camera last', 'history of equipment X', 'recent checkouts'. Returns: up to 5 recent checkout records for the best matching item — person, checkout date, return date.",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        itemName: { type: "string", description: "Substring (min 3 chars) of the inventory item name." },
      },
      required: ["itemName"],
    },
  },
  {
    name: "searchEvents",
    description:
      "Use when the user mentions an event by name and you need to locate it. Returns: up to 5 events matching the substring (case-insensitive). For full details after locating, call getEventDetails.",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Substring (min 3 chars) of the event title." },
      },
      required: ["query"],
    },
  },
  {
    name: "searchMembers",
    description:
      "Use when the user mentions a person by partial name. Returns: up to 5 matching members with name, role, department, position. For full directory info call getMemberInfo.",
    requires: "any",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Substring (min 3 chars) of the member's name." },
      },
      required: ["query"],
    },
  },

  // ─── headOrAdmin tier ──────────────────────────────────────────────────
  {
    name: "getPendingApprovals",
    description:
      "Use when the user asks 'what needs my approval', 'review queue', 'pending reviews'. Returns: list of projects and content posts awaiting review. Requires HEAD or ADMIN role — if the caller lacks this, the tool returns FORBIDDEN and you should politely explain in Georgian that this needs HEAD or ADMIN access.",
    requires: "headOrAdmin",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getWorkloadOverview",
    description:
      "Use when the user asks about workload distribution across the team, 'who's busiest', or 'team capacity'. Returns: top 5 busiest members (active project count, upcoming event count) and overall totals. Requires HEAD or ADMIN role — if the caller lacks this, the tool returns FORBIDDEN and you should politely explain that the workload view is only available to HEAD or ADMIN.",
    requires: "headOrAdmin",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getAttendanceStats",
    description:
      "Use when the user asks for attendance trends, department attendance rates, or who's been present most often. Returns: per-status totals, top members by attendance, department breakdown. Requires HEAD or ADMIN role — if the caller lacks this, the tool returns FORBIDDEN and you should politely explain that attendance stats are restricted to HEAD or ADMIN.",
    requires: "headOrAdmin",
    parametersJsonSchema: { type: "object", properties: {}, required: [] },
  },
] as const satisfies readonly VoiceAssistantToolDecl[];

export type VoiceAssistantToolName = (typeof VOICE_ASSISTANT_TOOLS)[number]["name"];

// Strip the server-only `requires` field before sending to Gemini —
// the API rejects unknown fields on FunctionDeclaration.
export function toFunctionDeclarations(
  tools: readonly VoiceAssistantToolDecl[] = VOICE_ASSISTANT_TOOLS
) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parametersJsonSchema: t.parametersJsonSchema,
  }));
}

// Lookup helper used by the dispatcher to find a tool's required role.
export function findToolDecl(
  name: string
): VoiceAssistantToolDecl | undefined {
  return VOICE_ASSISTANT_TOOLS.find((t) => t.name === name);
}
