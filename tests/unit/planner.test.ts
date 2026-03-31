import { describe, expect, it } from "vitest";

import { buildMetadata, createNextCursor, createPerformanceQueryPlan } from "../../src/domain/planner.js";
import { testConfig } from "../helpers.js";
import { resolveAllowedProperty } from "../../src/utils/site-url.js";

describe("performance planner", () => {
  it("splits long detail queries by day", () => {
    const property = resolveAllowedProperty(testConfig, "main");
    const plan = createPerformanceQueryPlan({
      config: testConfig,
      property,
      cursorSecret: "secret",
      intent: {
        site: "main",
        startDate: "2026-01-01",
        endDate: "2026-01-10",
        dimensions: ["query"],
      },
    });

    expect(plan.splitApplied).toBe(true);
    expect(plan.splitStrategy).toBe("detail_daily");
    expect(plan.dateRanges).toHaveLength(10);
    expect(plan.costClass).toBe("high");
  });

  it("chunks long summary queries instead of rejecting them", () => {
    const property = resolveAllowedProperty(testConfig, "main");
    const plan = createPerformanceQueryPlan({
      config: testConfig,
      property,
      cursorSecret: "secret",
      intent: {
        site: "main",
        startDate: "2026-01-01",
        endDate: "2026-05-01",
      },
    });

    expect(plan.splitApplied).toBe(true);
    expect(plan.splitStrategy).toBe("summary_chunked");
    expect(plan.dateRanges).toHaveLength(2);
    expect(plan.dateRanges[0]).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-03-31",
    });
  });

  it("rejects deprecated searchType", () => {
    const property = resolveAllowedProperty(testConfig, "main");
    expect(() =>
      createPerformanceQueryPlan({
        config: testConfig,
        property,
        cursorSecret: "secret",
        intent: {
          site: "main",
          startDate: "2026-01-01",
          endDate: "2026-01-02",
          searchType: "web",
        },
      }),
    ).toThrowError(/deprecated/);
  });

  it("rejects mixed searchAppearance dimensions", () => {
    const property = resolveAllowedProperty(testConfig, "main");
    expect(() =>
      createPerformanceQueryPlan({
        config: testConfig,
        property,
        cursorSecret: "secret",
        intent: {
          site: "main",
          startDate: "2026-01-01",
          endDate: "2026-01-02",
          dimensions: ["searchAppearance", "page"],
        },
      }),
    ).toThrowError(/search_appearance\.list/);
  });

  it("rejects filtered first-step searchAppearance queries", () => {
    const property = resolveAllowedProperty(testConfig, "main");
    expect(() =>
      createPerformanceQueryPlan({
        config: testConfig,
        property,
        cursorSecret: "secret",
        intent: {
          site: "main",
          startDate: "2026-01-01",
          endDate: "2026-01-02",
          dimensions: ["searchAppearance"],
          filters: [
            {
              dimension: "country",
              operator: "equals",
              expression: "usa",
            },
          ],
        },
      }),
    ).toThrowError(/search_appearance\.list/);
  });

  it("adds top-row and fresh reasons to metadata", () => {
    const property = resolveAllowedProperty(testConfig, "main");
    const plan = createPerformanceQueryPlan({
      config: testConfig,
      property,
      cursorSecret: "secret",
      intent: {
        site: "main",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        dimensions: ["query"],
        dataState: "all",
      },
    });
    const nextCursor = createNextCursor({
      cursorSecret: "secret",
      requestHash: plan.requestHash,
      startRow: 1000,
      pageSize: 1000,
    });
    const metadata = buildMetadata({
      plan,
      responseAggregationType: "auto",
      firstIncompleteDate: "2026-01-02",
      nextCursor,
    });
    expect(metadata.accuracyClass).toBe("top_rows_and_fresh");
    expect(metadata.reasons).toContain("PAGE_OR_QUERY_DIMENSION");
    expect(metadata.reasons).toContain("FRESH_DATA_STATE");
    expect(metadata.reasons).toContain("TOP_ROWS_LIMIT");
  });

  it("uses the configured default dataState when omitted", () => {
    const config = {
      ...testConfig,
      queryPolicy: {
        ...testConfig.queryPolicy,
        defaultDataState: "all" as const,
      },
    };
    const property = resolveAllowedProperty(config, "main");
    const plan = createPerformanceQueryPlan({
      config,
      property,
      cursorSecret: "secret",
      intent: {
        site: "main",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
      },
    });

    expect(plan.normalizedIntent.dataState).toBe("all");
  });

  it("fails clearly for prefer_exact detail queries on live API", () => {
    const property = resolveAllowedProperty(testConfig, "main");
    expect(() =>
      createPerformanceQueryPlan({
        config: testConfig,
        property,
        cursorSecret: "secret",
        intent: {
          site: "main",
          startDate: "2026-01-01",
          endDate: "2026-01-02",
          dimensions: ["query"],
          fidelity: "prefer_exact",
        },
      }),
    ).toThrowError(/prefer_exact/);
  });
});
