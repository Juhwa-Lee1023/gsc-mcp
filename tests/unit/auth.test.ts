import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createAuthorizedClient } from "../../src/gsc/auth.js";
import { MemoryTokenStore } from "../helpers.js";

describe("oauth client persistence", () => {
  it("persists refreshed tokens back to the token store", async () => {
    const tokenStore = new MemoryTokenStore();
    tokenStore.record = {
      scopeMode: "readonly",
      credentials: {
        refresh_token: "refresh-token",
        access_token: "old-token",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const { oauthClient } = await createAuthorizedClient(
      {
        googleClientId: "test-client-id",
        googleClientSecret: "test-client-secret",
        dataDir: path.join(os.tmpdir(), "gsc-mcp-auth-tests"),
        debug: false,
      },
      tokenStore,
    );

    const previousUpdatedAt = tokenStore.record.updatedAt;
    (oauthClient as unknown as { emit(event: string, payload: unknown): boolean }).emit("tokens", {
      access_token: "new-token",
      expiry_date: 123456789,
    });
    await Promise.resolve();

    expect(tokenStore.record?.credentials.access_token).toBe("new-token");
    expect(tokenStore.record?.credentials.refresh_token).toBe("refresh-token");
    expect(tokenStore.record?.updatedAt).not.toBe(previousUpdatedAt);
  });
});
