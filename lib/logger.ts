// Structured logger.
//
// In production every log line is emitted as a single JSON object on one stdout
// line. This is what Vercel's log drain expects — Vercel parses JSON lines and
// makes the fields filterable in the dashboard. In development we keep the
// output human-readable so it's easier to scan.
//
// Usage:
//   import { log } from "@/lib/logger";
//   log.error("Login failed", error, { email });
//   log.warn("Push delivery failed", { endpoint, reason });
//   log.info("Briefing generated", { userId, briefingDate });
//
// The second argument can be either an Error (its message, name, and stack are
// extracted automatically) or a plain context object. Pass both with three args:
//   log.error("Briefing failed", error, { userId });
//
// Never log secrets — JWT_SECRET, password hashes, API tokens. Log identifiers
// (userId, email) and outcome only.

type Level = "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogPayload {
  level: Level;
  message: string;
  timestamp: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: LogContext;
}

// Pull Error fields into a shape that JSON.stringify can serialize.
// (Error instances stringify to "{}" by default because their fields are non-enumerable.)
function serializeError(error: unknown): LogPayload["error"] | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    name: "NonError",
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
}

// Next.js uses thrown errors with a "digest" of "DYNAMIC_SERVER_USAGE" as a
// control-flow signal to switch a route from static to dynamic rendering. If
// an action's catch block logs and swallows one, the route still works (Next
// detects dynamism via cookies()/headers()) but the build output is polluted
// with noisy "errors" that aren't real. Detect and silently re-throw them so
// Next's machinery can see them and our logs stay clean.
function isNextControlFlowError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    ((err as { digest: string }).digest === "DYNAMIC_SERVER_USAGE" ||
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (err as { digest: string }).digest.startsWith("NEXT_NOT_FOUND"))
  );
}

function emit(payload: LogPayload) {
  // In production, emit a single JSON line so Vercel's log drain can parse it.
  if (process.env.NODE_ENV === "production") {
    const output = JSON.stringify(payload);
    if (payload.level === "error") {
      console.error(output);
    } else if (payload.level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
    return;
  }

  // Development: human-readable. Keep the Error object so the stack stays clickable in the terminal.
  const prefix = `[${payload.level.toUpperCase()}]`;
  const ctx = payload.context ? payload.context : "";
  if (payload.error) {
    if (payload.level === "error") {
      console.error(prefix, payload.message, ctx, "\n", payload.error.stack ?? payload.error.message);
    } else if (payload.level === "warn") {
      console.warn(prefix, payload.message, ctx, payload.error.message);
    }
  } else {
    if (payload.level === "error") console.error(prefix, payload.message, ctx);
    else if (payload.level === "warn") console.warn(prefix, payload.message, ctx);
    else console.log(prefix, payload.message, ctx);
  }
}

function buildPayload(
  level: Level,
  message: string,
  errorOrContext?: unknown,
  context?: LogContext
): LogPayload {
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  // Argument 2 can be either an Error or a context object.
  // If both Error and context are passed, error is arg 2 and context is arg 3.
  if (errorOrContext instanceof Error) {
    payload.error = serializeError(errorOrContext);
    if (context) payload.context = context;
  } else if (errorOrContext && typeof errorOrContext === "object") {
    payload.context = errorOrContext as LogContext;
  } else if (errorOrContext !== undefined) {
    payload.error = serializeError(errorOrContext);
  }

  return payload;
}

export const log = {
  info(message: string, context?: LogContext) {
    emit(buildPayload("info", message, context));
  },
  warn(message: string, errorOrContext?: unknown, context?: LogContext) {
    if (isNextControlFlowError(errorOrContext)) throw errorOrContext;
    emit(buildPayload("warn", message, errorOrContext, context));
  },
  error(message: string, errorOrContext?: unknown, context?: LogContext) {
    // Re-throw Next.js control-flow errors instead of logging — see comment above.
    if (isNextControlFlowError(errorOrContext)) throw errorOrContext;
    emit(buildPayload("error", message, errorOrContext, context));
  },
};
