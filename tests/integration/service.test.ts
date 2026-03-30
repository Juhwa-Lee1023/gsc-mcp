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
      "secret",
      noopLogger,
      (selector) => resolveAllowedProperty(testConfig, selector),
    );

    await expect(service.inspectUrl("blog", "https://example.com/shop/page")).rejects.toThrow(/outside/i);
  });
});
