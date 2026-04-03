import { describe, expect, it } from "vitest";

import type { AuditEvent, AuditSink, Logger } from "../../src/domain/types.js";
import { safeWriteAuditEvent } from "../../src/security/audit-utils.js";

class FailingAuditSink implements AuditSink {
  async write(_event: AuditEvent): Promise<void> {
    throw new Error("disk full");
  }
}

describe("safeWriteAuditEvent", () => {
  it("logs tool context when audit writes fail", async () => {
    const logged: Array<{ message: string; details?: Record<string, unknown> }> = [];
    const logger: Logger = {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: (message, details) => {
        logged.push({ message, details });
      },
    };

    await safeWriteAuditEvent(new FailingAuditSink(), logger, {
      timestamp: new Date().toISOString(),
      action: "tool.invoke",
      outcome: "failure",
      toolName: "gsc.sitemaps.delete",
      siteAlias: "main",
      details: {
        feedpath: "https://example.com/sitemap.xml",
      },
    });

    expect(logged).toEqual([
      {
        message: "Failed to write audit event",
        details: expect.objectContaining({
          auditAction: "tool.invoke",
          auditOutcome: "failure",
          auditToolName: "gsc.sitemaps.delete",
          auditSiteAlias: "main",
          errorCode: "INTERNAL_ERROR",
          retryable: false,
        }),
      },
    ]);
  });
});
