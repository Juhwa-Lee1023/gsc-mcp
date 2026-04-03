import { toDomainError } from "../domain/errors.js";
import type { AuditEvent, AuditSink, Logger } from "../domain/types.js";

export async function safeWriteAuditEvent(
  audit: AuditSink,
  logger: Logger,
  event: AuditEvent,
): Promise<void> {
  try {
    await audit.write(event);
  } catch (error) {
    const domainError = toDomainError(error);
    logger.error("Failed to write audit event", {
      auditAction: event.action,
      auditOutcome: event.outcome,
      auditToolName: event.toolName ?? null,
      auditSiteAlias: event.siteAlias ?? null,
      errorCode: domainError.code,
      retryable: domainError.retryable,
    });
  }
}
