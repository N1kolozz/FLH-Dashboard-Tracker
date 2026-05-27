"use server";

import { GoogleGenAI } from "@google/genai";
import {
  requireAuthenticatedSession,
  requireHeadOrAdminSession,
} from "@/lib/action-auth";
import { getSessionUserId } from "@/lib/permissions";
import { log } from "@/lib/logger";
import {
  VOICE_ASSISTANT_API_VERSION,
  VOICE_ASSISTANT_MODEL,
  findToolDecl,
  type VoiceAssistantToolName,
} from "@/lib/voice-assistant/config";
import {
  sanitizeArgsForLogging,
  isHeadOrAdminSession,
} from "@/lib/voice-assistant/util";
import { checkVoiceRateLimit } from "@/lib/voice-assistant/rate-limit";
import * as tools from "./voice-assistant-tools";
import type { Session } from "@/lib/auth";

// ── Token mint ──────────────────────────────────────────────────────────────

const TOKEN_NEW_SESSION_WINDOW_MS = 60 * 1000;
const TOKEN_TOTAL_LIFETIME_MS = 30 * 60 * 1000;

export type VoiceAssistantTokenResult =
  | {
      success: true;
      token: string;
      model: string;
      apiVersion: string;
      expiresAt: string;
      user: { fullName: string; role: string; department: string };
    }
  | { success: false; error: string };

export async function createVoiceAssistantToken(): Promise<VoiceAssistantTokenResult> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return { success: false, error: "GEMINI_API_KEY is not set." };
    }

    const session = await requireAuthenticatedSession();

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const now = Date.now();
    const expireTime = new Date(now + TOKEN_TOTAL_LIFETIME_MS).toISOString();
    const newSessionExpireTime = new Date(now + TOKEN_NEW_SESSION_WINDOW_MS).toISOString();

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: VOICE_ASSISTANT_API_VERSION },
      },
    });

    if (!token.name) {
      return { success: false, error: "Gemini did not return a token name." };
    }

    return {
      success: true,
      token: token.name,
      model: VOICE_ASSISTANT_MODEL,
      apiVersion: VOICE_ASSISTANT_API_VERSION,
      expiresAt: expireTime,
      user: {
        fullName: session.fullName,
        role: session.role,
        department: session.department,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Voice assistant token mint failed", error);
    return { success: false, error: message };
  }
}

// ── Tool dispatcher ─────────────────────────────────────────────────────────

export type VoiceAssistantToolResult =
  | { success: true; data: unknown }
  | {
      success: false;
      error: "FORBIDDEN" | "RATE_LIMITED" | "UNKNOWN_TOOL" | string;
      message?: string;
      requiredRole?: "headOrAdmin";
      callerRole?: string;
      retryAfterMs?: number;
    };

async function dispatch(
  name: string,
  userId: number,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name as VoiceAssistantToolName) {
    case "getDashboardOverview":     return tools.tool_getDashboardOverview();
    case "getUpcomingEvents":        return tools.tool_getUpcomingEvents(args);
    case "getProjectsSummary":       return tools.tool_getProjectsSummary();
    case "getMyAssignments":         return tools.tool_getMyAssignments(userId);
    case "getSocialStats":           return tools.tool_getSocialStats();
    case "getTeamRoster":            return tools.tool_getTeamRoster(args);
    case "searchProjects":           return tools.tool_searchProjects(args);
    case "getDashboardNavigationHelp": return tools.tool_getDashboardNavigationHelp();
    case "getTodaysBriefing":        return tools.tool_getTodaysBriefing();
    case "getMyToday":               return tools.tool_getMyToday(userId);
    case "getPendingAttendance":     return tools.tool_getPendingAttendance();
    case "getEventDetails":          return tools.tool_getEventDetails(args);
    case "getMemberInfo":            return tools.tool_getMemberInfo(args);
    case "getInventoryStatus":       return tools.tool_getInventoryStatus(args);
    case "getProjectDetails":        return tools.tool_getProjectDetails(args);
    case "getContentCalendar":       return tools.tool_getContentCalendar(args);
    case "getMonthlySpending":       return tools.tool_getMonthlySpending(args);
    case "getRecentImpact":          return tools.tool_getRecentImpact(args);
    case "getDeadlinesThisWeek":     return tools.tool_getDeadlinesThisWeek();
    case "getOverdueProjects":       return tools.tool_getOverdueProjects();
    case "getMemberAttendanceRate":  return tools.tool_getMemberAttendanceRate(userId);
    case "getLatestNews":            return tools.tool_getLatestNews(args);
    case "getCheckoutHistory":       return tools.tool_getCheckoutHistory(args);
    case "searchEvents":             return tools.tool_searchEvents(args);
    case "searchMembers":            return tools.tool_searchMembers(args);
    case "getPendingApprovals":      return tools.tool_getPendingApprovals();
    case "getWorkloadOverview":      return tools.tool_getWorkloadOverview();
    case "getAttendanceStats":       return tools.tool_getAttendanceStats();
    default: {
      // unreachable due to outer guard, but keeps TS exhaustiveness happy
      const _exhaustive: never = name as never;
      void _exhaustive;
      throw new Error(`unknown tool: ${name}`);
    }
  }
}

export async function runVoiceAssistantTool(
  name: string,
  args: Record<string, unknown> = {}
): Promise<VoiceAssistantToolResult> {
  const startedAt = performance.now();
  let session: Session;
  let userId: number;

  // 1) Authentication — required for ALL tools.
  try {
    session = await requireAuthenticatedSession();
    const id = getSessionUserId(session);
    if (!id) {
      return { success: false, error: "Missing user id." };
    }
    userId = id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }

  // 2) Look up the tool declaration.
  const decl = findToolDecl(name);
  if (!decl) {
    log.warn("voice_tool_unknown", { name, userId });
    return {
      success: false,
      error: "UNKNOWN_TOOL",
      message: `unknown tool: ${name}`,
    };
  }

  // 3) Role gate.
  if (decl.requires === "headOrAdmin") {
    try {
      await requireHeadOrAdminSession();
    } catch {
      log.info("voice_tool_call", {
        name,
        userId,
        role: session.role,
        ok: false,
        reason: "FORBIDDEN",
      });
      return {
        success: false,
        error: "FORBIDDEN",
        requiredRole: "headOrAdmin",
        callerRole: session.role,
        message:
          "This tool requires HEAD or ADMIN role. Politely explain in Georgian that the user lacks access.",
      };
    }
  }

  // 4) Rate limit.
  const rl = checkVoiceRateLimit(userId);
  if (!rl.allowed) {
    log.info("voice_tool_call", {
      name,
      userId,
      role: session.role,
      ok: false,
      reason: "RATE_LIMITED",
    });
    return {
      success: false,
      error: "RATE_LIMITED",
      retryAfterMs: rl.retryAfterMs,
      message:
        "Rate limit reached (30 tool calls / 5 minutes). Politely ask the user to wait a moment.",
    };
  }

  // 5) Execute.
  try {
    const data = await dispatch(name, userId, args);
    const ms = Math.round(performance.now() - startedAt);
    log.info("voice_tool_call", {
      name,
      userId,
      role: session.role,
      ok: true,
      ms,
      argNames: Object.keys(sanitizeArgsForLogging(args)),
    });
    return { success: true, data };
  } catch (error: unknown) {
    const ms = Math.round(performance.now() - startedAt);
    const message = error instanceof Error ? error.message : String(error);
    log.error("voice_tool_call_failed", error, {
      name,
      userId,
      role: session.role,
      ms,
      args: sanitizeArgsForLogging(args),
    });
    return { success: false, error: message };
  }
}

// Suppress lint warning — exported function reads helper for type-only side
// effect (isHeadOrAdminSession is re-exported below for ergonomics).
void isHeadOrAdminSession;
