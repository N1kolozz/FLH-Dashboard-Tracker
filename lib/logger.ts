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
    emit(buildPayload("warn", message, errorOrContext, context));
  },
  error(message: string, errorOrContext?: unknown, context?: LogContext) {
    emit(buildPayload("error", message, errorOrContext, context));
  },
};
