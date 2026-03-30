import type { Logger } from "../domain/types.js";
import { redactRecord } from "./redaction.js";

export function createLogger(
  debugEnabled: boolean,
  redaction?: { redactPageUrls?: boolean; redactQueryStrings?: boolean },
): Logger {
  function write(level: "debug" | "info" | "warn" | "error", message: string, details?: Record<string, unknown>): void {
    if (level === "debug" && !debugEnabled) {
      return;
    }

    process.stderr.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        details: details ? redactRecord(details, redaction) : undefined,
      })}\n`,
    );
  }

  return {
    debug: (message, details) => write("debug", message, details),
    info: (message, details) => write("info", message, details),
    warn: (message, details) => write("warn", message, details),
    error: (message, details) => write("error", message, details),
  };
}
