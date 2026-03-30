import path from "node:path";

import type { AuditEvent, AuditSink, LoggingConfig } from "../domain/types.js";
import { appendJsonLine } from "../utils/fs.js";
import { redactRecord } from "./redaction.js";

export class FileAuditSink implements AuditSink {
  constructor(
    private readonly dataDir: string,
    private readonly logging: LoggingConfig,
  ) {}

  async write(event: AuditEvent): Promise<void> {
    const auditPath = this.logging.auditLogPath
      ? path.resolve(process.cwd(), this.logging.auditLogPath)
      : path.join(this.dataDir, "audit", "events.jsonl");

    await appendJsonLine(auditPath, {
      ...event,
      details: event.details ? redactRecord(event.details, this.logging) : undefined,
    });
  }
}
