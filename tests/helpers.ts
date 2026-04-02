import os from "node:os";
import path from "node:path";

import type {
  AppConfig,
  AuditEvent,
  AuditSink,
  CacheStore,
  Logger,
  RuntimeContext,
  TokenRecord,
  TokenStore,
} from "../src/domain/types.js";
import { resolvePropertyConfig } from "../src/utils/site-url.js";

export const testConfig: AppConfig = {
  google: {
    defaultScope: "readonly",
  },
  properties: [
    {
      alias: "main",
      siteUrl: "sc-domain:example.com",
      allowRead: true,
    },
    {
      alias: "blog",
      siteUrl: "https://example.com/blog/",
      allowRead: true,
    },
  ],
  toolPolicy: {
    enabledTools: [
      "gsc.sites.list",
      "gsc.sites.get",
      "gsc.performance.query",
      "gsc.performance.search_appearance.list",
      "gsc.url.inspect",
      "gsc.sitemaps.list",
      "gsc.sitemaps.get",
    ],
    disabledTools: [],
  },
  writePolicy: {
    enabled: false,
    allowedTools: [],
    requireConfirmationForDestructive: true,
    siteAddAllowlist: [],
    siteAddAllowPatterns: [],
    siteDeleteAllowlist: [],
    siteDeleteAllowPatterns: [],
  },
  queryPolicy: {
    defaultDataState: "final",
    summaryMaxDays: 90,
    detailMaxDays: 31,
    detailSplitDailyAfterDays: 7,
  },
  cache: {
    enabled: true,
    sitesTtlSeconds: 300,
    sitemapsTtlSeconds: 300,
    urlInspectionTtlSeconds: 3600,
    finalizedPerformanceTtlSeconds: 43200,
    freshPerformanceTtlSeconds: 300,
  },
  logging: {
    redactPageUrls: true,
    redactQueryStrings: true,
    auditLogPath: ".gsc-mcp/audit/events.jsonl",
  },
};

export class MemoryCacheStore implements CacheStore {
  private readonly values = new Map<string, { expiresAt: number; value: unknown }>();

  async get<T>(namespace: string, key: string): Promise<T | null> {
    const entry = this.values.get(`${namespace}:${key}`);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.values.delete(`${namespace}:${key}`);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(namespace: string, key: string, value: T, ttlSeconds: number): Promise<void> {
    this.values.set(`${namespace}:${key}`, {
      expiresAt: Date.now() + ttlSeconds * 1000,
      value,
    });
  }

  async delete(namespace: string, key: string): Promise<void> {
    this.values.delete(`${namespace}:${key}`);
  }

  async deletePrefix(namespace: string, keyPrefix: string): Promise<void> {
    const fullPrefix = `${namespace}:${keyPrefix}`;
    for (const key of this.values.keys()) {
      if (key.startsWith(fullPrefix)) {
        this.values.delete(key);
      }
    }
  }

  async clearExpired(): Promise<void> {
    for (const [key, entry] of this.values.entries()) {
      if (entry.expiresAt <= Date.now()) {
        this.values.delete(key);
      }
    }
  }

  async close(): Promise<void> {}
}

export class MemoryTokenStore implements TokenStore {
  kind = "memory";
  record: TokenRecord | null = null;

  async get(): Promise<TokenRecord | null> {
    return this.record;
  }

  async set(record: TokenRecord): Promise<void> {
    this.record = record;
  }

  async delete(): Promise<void> {
    this.record = null;
  }
}

export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export const noopAudit: AuditSink = {
  write: async (_event: AuditEvent) => undefined,
};

export class MemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  async write(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

export function createTestContext(): RuntimeContext {
  const tokenStore = new MemoryTokenStore();
  const config = structuredClone(testConfig);
  return {
    env: {
      googleClientId: "test-client-id",
      googleClientSecret: "test-client-secret",
      dataDir: path.join(os.tmpdir(), "gsc-mcp-tests"),
      debug: false,
      cacheDbPath: undefined,
      fileTokenSecret: "test-secret",
    },
    config,
    properties: config.properties.map(resolvePropertyConfig),
    logger: noopLogger,
    audit: noopAudit,
    tokenStore,
    cache: new MemoryCacheStore(),
    cursorSigningSecret: "test-cursor-secret",
  };
}
