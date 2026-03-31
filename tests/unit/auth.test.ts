import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createAuthorizedClient } from "../../src/gsc/auth.js";
import type { Logger, TokenRecord, TokenStore } from "../../src/domain/types.js";
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

  it("logs refresh-token persistence failures without creating unhandled writes", async () => {
    const warnings: Array<{ message: string; details?: Record<string, unknown> }> = [];
    const logger: Pick<Logger, "warn"> = {
      warn(message, details) {
        warnings.push({ message, details });
      },
    };
    const tokenStore: TokenStore = {
      kind: "failing-memory",
      async get(): Promise<TokenRecord | null> {
        return {
          scopeMode: "readonly",
          credentials: {
            refresh_token: "refresh-token",
            access_token: "old-token",
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        };
      },
      async set(): Promise<void> {
        throw new Error("disk full");
      },
      async delete(): Promise<void> {},
    };

    const { oauthClient } = await createAuthorizedClient(
      {
        googleClientId: "test-client-id",
        googleClientSecret: "test-client-secret",
        dataDir: path.join(os.tmpdir(), "gsc-mcp-auth-tests"),
        debug: false,
      },
      tokenStore,
      logger,
    );

    (oauthClient as unknown as { emit(event: string, payload: unknown): boolean }).emit("tokens", {
      access_token: "new-token",
      expiry_date: 123456789,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      message: "Failed to persist refreshed Google OAuth token",
      details: {
        tokenStore: "failing-memory",
        error: "disk full",
      },
    });
  });
});
