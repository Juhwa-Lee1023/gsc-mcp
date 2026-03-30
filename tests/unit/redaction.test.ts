import { describe, expect, it } from "vitest";

import { redactRecord } from "../../src/security/redaction.js";

describe("redaction", () => {
  it("redacts sensitive keys case-insensitively", () => {
    const redacted = redactRecord({
      Authorization: "Bearer secret",
      "Client-Secret": "secret-value",
      access_token: "token",
    });

    expect(redacted.Authorization).toBe("[REDACTED]");
    expect(redacted["Client-Secret"]).toBe("[REDACTED]");
    expect(redacted.access_token).toBe("[REDACTED]");
  });
});
