import { describe, expect, it } from "vitest";

import { parsePerformanceQueryInput, parseUrlInspectionInput } from "../../src/domain/inputs.js";

describe("shared input parsing", () => {
  it("rejects unsupported source preferences for v1", () => {
    expect(() =>
      parsePerformanceQueryInput({
        site: "main",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        sourcePreference: "mirror",
      }),
    ).toThrowError(/Invalid performance query input/);
  });

  it("rejects empty cursors instead of silently treating them as first-page requests", () => {
    expect(() =>
      parsePerformanceQueryInput({
        site: "main",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        cursor: "",
      }),
    ).toThrowError(/Invalid performance query input/);
  });

  it("defaults forceRefresh to false for URL inspection", () => {
    expect(
      parseUrlInspectionInput({
        site: "main",
        url: "https://example.com/page",
      }),
    ).toEqual({
      site: "main",
      url: "https://example.com/page",
      forceRefresh: false,
    });
  });
});
