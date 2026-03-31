import { describe, expect, it } from "vitest";

import { GscService } from "../../src/gsc/service.js";
import type { GscClient, SearchAnalyticsApiResponse } from "../../src/domain/types.js";
import { MemoryAuditSink, MemoryCacheStore, noopAudit, noopLogger, testConfig } from "../helpers.js";
import { resolveAllowedProperty } from "../../src/utils/site-url.js";

class MockGscClient implements GscClient {
  async listSites() {
    return {
      siteEntry: [
        { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
        { siteUrl: "https://example.com/blog/", permissionLevel: "siteFullUser" },
      ],
    };
  }

  async getSite(siteUrl: string) {
    return { siteUrl, permissionLevel: "siteOwner" };
  }

  async querySearchAnalytics(_siteUrl: string, request: {
    startDate: string;
    endDate: string;
    type: string;
    dimensions: string[];
    filters: Array<{ dimension: string; operator: string; expression: string }>;
    aggregationType: string;
    dataState: string;
    rowLimit: number;
    startRow: number;
  }): Promise<SearchAnalyticsApiResponse> {
    if (request.startDate === request.endDate) {
      return {
        rows: [
          {
            keys: ["alpha"],
            clicks: 5,
            impressions: 100,
            ctr: 0.05,
            position: 2,
          },
        ],
        responseAggregationType: "byPage",
      };
    }

    return {
      rows: [
        {
          keys: ["alpha"],
          clicks: 10,
          impressions: 200,
          ctr: 0.05,
          position: 2,
        },
      ],
      responseAggregationType: "byPage",
    };
  }

  async inspectUrl(siteUrl: string, inspectionUrl: string) {
    return {
      siteUrl,
      inspectionUrl,
      result: "ok",
    };
  }

  async listSitemaps() {
    return [{ path: "https://example.com/sitemap.xml" }];
  }

  async getSitemap(_siteUrl: string, feedpath: string) {
    return { path: feedpath };
  }
}

describe("gsc service", () => {
  it("merges split detail queries and returns accuracy metadata", async () => {
    const audit = new MemoryAuditSink();
    const service = new GscService(
      testConfig,
      new MockGscClient(),
      new MemoryCacheStore(),
      "account-a",
      "secret",
      noopLogger,
      audit,
      (selector) => resolveAllowedProperty(testConfig, selector),
    );

    const result = await service.queryPerformance({
      site: "main",
      startDate: "2026-01-01",
      endDate: "2026-01-10",
      dimensions: ["query"],
      pageSize: 1000,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.clicks).toBe(50);
    expect(result.metadata.splitApplied).toBe(true);
    expect(result.metadata.accuracyClass).toBe("top_rows_only");
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "tool.invoke",
      outcome: "success",
      toolName: "gsc.performance.query",
      siteAlias: "main",
      details: expect.objectContaining({
        requestClass: "detail",
        accuracyClass: "top_rows_only",
        splitApplied: true,
      }),
    });
  });

  it("validates url inspection boundaries and records failure audits", async () => {
    const audit = new MemoryAuditSink();
    const service = new GscService(
      testConfig,
      new MockGscClient(),
      new MemoryCacheStore(),
      "account-a",
      "secret",
      noopLogger,
      audit,
      (selector) => resolveAllowedProperty(testConfig, selector),
    );

    await expect(service.inspectUrl({ site: "blog", url: "https://example.com/shop/page" })).rejects.toThrow(/outside/i);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: "tool.invoke",
      outcome: "failure",
      toolName: "gsc.url.inspect",
      siteAlias: "blog",
      details: expect.objectContaining({
        errorCode: "URL_OUTSIDE_PROPERTY",
        retryable: false,
      }),
    });
  });

  it("does not reuse cached performance data across account scopes", async () => {
    let requestCount = 0;
    class ScopedClient extends MockGscClient {
      override async querySearchAnalytics(...args: Parameters<GscClient["querySearchAnalytics"]>) {
        const response = await super.querySearchAnalytics(...args);
        requestCount += 1;
        return {
          ...response,
          rows: [
            {
              keys: ["alpha"],
              clicks: requestCount,
              impressions: 100,
              ctr: 0.01 * requestCount,
              position: 1,
            },
          ],
        };
      }
    }

    const cache = new MemoryCacheStore();
    const client = new ScopedClient();
    const serviceA = new GscService(
      testConfig,
      client,
      cache,
      "account-a",
      "secret",
      noopLogger,
      noopAudit,
      (selector) => resolveAllowedProperty(testConfig, selector),
    );
    const serviceB = new GscService(
      testConfig,
      client,
      cache,
      "account-b",
      "secret",
      noopLogger,
      noopAudit,
      (selector) => resolveAllowedProperty(testConfig, selector),
    );

    const first = await serviceA.queryPerformance({
      site: "main",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const second = await serviceB.queryPerformance({
      site: "main",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });

    expect(first.rows[0]?.clicks).toBe(1);
    expect(second.rows[0]?.clicks).toBe(2);
    expect(requestCount).toBe(2);
  });

  it("caches sitemap lookups for identical normalized feedpaths", async () => {
    let sitemapRequests = 0;
    class CountingClient extends MockGscClient {
      override async getSitemap(...args: Parameters<GscClient["getSitemap"]>) {
        sitemapRequests += 1;
        return super.getSitemap(...args);
      }
    }

    const service = new GscService(
      testConfig,
      new CountingClient(),
      new MemoryCacheStore(),
      "account-a",
      "secret",
      noopLogger,
      noopAudit,
      (selector) => resolveAllowedProperty(testConfig, selector),
    );

    const first = await service.getSitemap("main", "https://example.com/sitemap.xml");
    const second = await service.getSitemap("main", " https://example.com/sitemap.xml ");

    expect(first).toEqual(second);
    expect(sitemapRequests).toBe(1);
  });

  it("records only one audit event for search appearance helper queries", async () => {
    const audit = new MemoryAuditSink();
    const service = new GscService(
      testConfig,
      new MockGscClient(),
      new MemoryCacheStore(),
      "account-a",
      "secret",
      noopLogger,
      audit,
      (selector) => resolveAllowedProperty(testConfig, selector),
    );

    await service.listSearchAppearance({
      site: "main",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });

    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      toolName: "gsc.performance.search_appearance.list",
      outcome: "success",
    });
  });

  it("does not fail successful calls when audit writing fails", async () => {
    const service = new GscService(
      testConfig,
      new MockGscClient(),
      new MemoryCacheStore(),
      "account-a",
      "secret",
      noopLogger,
      {
        write: async () => {
          throw new Error("disk full");
        },
      },
      (selector) => resolveAllowedProperty(testConfig, selector),
    );

    const result = await service.queryPerformance({
      site: "main",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });

    expect(result.rows).toHaveLength(1);
  });

  it("paginates split detail shards until each shard is exhausted", async () => {
    let requestCount = 0;
    class PaginatedShardClient extends MockGscClient {
      override async querySearchAnalytics(...args: Parameters<GscClient["querySearchAnalytics"]>) {
        const [, request] = args;
        requestCount += 1;
        if (request.startDate !== "2026-01-01") {
          return {
            rows: [],
            responseAggregationType: "byPage" as const,
          };
        }
        if (request.startRow === 0) {
          return {
            rows: Array.from({ length: 25_000 }, () => ({
              keys: ["alpha"],
              clicks: 1,
              impressions: 10,
              ctr: 0.1,
              position: 2,
            })),
            responseAggregationType: "byPage" as const,
          };
        }
        if (request.startRow === 25_000) {
          return {
            rows: [
              {
                keys: ["alpha"],
                clicks: 2,
                impressions: 10,
                ctr: 0.2,
                position: 2,
              },
            ],
            responseAggregationType: "byPage" as const,
          };
        }
        return {
          rows: [],
          responseAggregationType: "byPage" as const,
        };
      }
    }

    const service = new GscService(
      testConfig,
      new PaginatedShardClient(),
      new MemoryCacheStore(),
      "account-a",
      "secret",
      noopLogger,
      noopAudit,
      (selector) => resolveAllowedProperty(testConfig, selector),
    );

    const result = await service.queryPerformance({
      site: "main",
      startDate: "2026-01-01",
      endDate: "2026-01-08",
      dimensions: ["query"],
      pageSize: 10,
    });

    expect(requestCount).toBe(9);
    expect(result.metadata.splitStrategy).toBe("detail_daily");
    expect(result.rows[0]?.clicks).toBe(25_002);
  });

  it("fails clearly when a split shard exceeds the live API pagination safety budget", async () => {
    let requestCount = 0;
    class OverBudgetShardClient extends MockGscClient {
      override async querySearchAnalytics(...args: Parameters<GscClient["querySearchAnalytics"]>) {
        const [, request] = args;
        requestCount += 1;
        if (request.startDate !== "2026-01-01") {
          return {
            rows: [],
            responseAggregationType: "byPage" as const,
          };
        }
        return {
          rows: Array.from({ length: 25_000 }, () => ({
            keys: ["alpha"],
            clicks: 1,
            impressions: 10,
            ctr: 0.1,
            position: 2,
          })),
          responseAggregationType: "byPage" as const,
        };
      }
    }

    const service = new GscService(
      testConfig,
      new OverBudgetShardClient(),
      new MemoryCacheStore(),
      "account-a",
      "secret",
      noopLogger,
      noopAudit,
      (selector) => resolveAllowedProperty(testConfig, selector),
    );

    await expect(service.queryPerformance({
      site: "main",
      startDate: "2026-01-01",
      endDate: "2026-01-08",
      dimensions: ["query"],
      pageSize: 10,
    })).rejects.toThrow(/pagination safety budget/i);
    expect(requestCount).toBe(2);
  });

  it("chunks long summary ranges and merges chunk results", async () => {
    let requestCount = 0;
    class SummaryChunkClient extends MockGscClient {
      override async querySearchAnalytics(...args: Parameters<GscClient["querySearchAnalytics"]>) {
        const [, request] = args;
        requestCount += 1;
        return {
          rows: [
            {
              keys: ["summary"],
              clicks: request.startDate === "2026-01-01" ? 10 : 7,
              impressions: 100,
              ctr: 0.1,
              position: 3,
            },
          ],
          responseAggregationType: "byProperty" as const,
        };
      }
    }

    const service = new GscService(
      testConfig,
      new SummaryChunkClient(),
      new MemoryCacheStore(),
      "account-a",
      "secret",
      noopLogger,
      noopAudit,
      (selector) => resolveAllowedProperty(testConfig, selector),
    );

    const result = await service.queryPerformance({
      site: "main",
      startDate: "2026-01-01",
      endDate: "2026-05-01",
    });

    expect(requestCount).toBe(2);
    expect(result.metadata.splitStrategy).toBe("summary_chunked");
    expect(result.rows[0]?.clicks).toBe(17);
  });

  it("supports forceRefresh and reports cacheHit for URL inspection", async () => {
    let inspectionRequests = 0;
    class InspectionClient extends MockGscClient {
      override async inspectUrl(...args: Parameters<GscClient["inspectUrl"]>) {
        inspectionRequests += 1;
        return super.inspectUrl(...args);
      }
    }

    const service = new GscService(
      testConfig,
      new InspectionClient(),
      new MemoryCacheStore(),
      "account-a",
      "secret",
      noopLogger,
      noopAudit,
      (selector) => resolveAllowedProperty(testConfig, selector),
    );

    const first = await service.inspectUrl({ site: "main", url: "https://example.com/page" });
    const second = await service.inspectUrl({ site: "main", url: "https://example.com/page" });
    const third = await service.inspectUrl({ site: "main", url: "https://example.com/page", forceRefresh: true });

    expect(first.metadata.cacheHit).toBe(false);
    expect(second.metadata.cacheHit).toBe(true);
    expect(third.metadata.cacheHit).toBe(false);
    expect(inspectionRequests).toBe(2);
  });
});
