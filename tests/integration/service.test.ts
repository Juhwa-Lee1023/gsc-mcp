import { describe, expect, it } from "vitest";

import { GscService } from "../../src/gsc/service.js";
import type { GscClient, SearchAnalyticsApiResponse } from "../../src/domain/types.js";
import { MemoryCacheStore, noopLogger, testConfig } from "../helpers.js";
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
    const service = new GscService(
      testConfig,
      new MockGscClient(),
      new MemoryCacheStore(),
      "account-a",
      "secret",
      noopLogger,
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
  });

  it("validates url inspection boundaries", async () => {
    const service = new GscService(
      testConfig,
      new MockGscClient(),
      new MemoryCacheStore(),
      "account-a",
      "secret",
      noopLogger,
      (selector) => resolveAllowedProperty(testConfig, selector),
    );

    await expect(service.inspectUrl("blog", "https://example.com/shop/page")).rejects.toThrow(/outside/i);
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
      (selector) => resolveAllowedProperty(testConfig, selector),
    );
    const serviceB = new GscService(
      testConfig,
      client,
      cache,
      "account-b",
      "secret",
      noopLogger,
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
});
