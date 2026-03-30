import { describe, expect, it } from "vitest";

import { testConfig } from "../helpers.js";
import { assertUrlWithinProperty, normalizeSiteUrl, resolveAllowedProperty } from "../../src/utils/site-url.js";

describe("site url normalization", () => {
  it("normalizes domain properties", () => {
    expect(normalizeSiteUrl("sc-domain:Example.COM/")).toBe("sc-domain:example.com");
  });

  it("normalizes url-prefix properties", () => {
    expect(normalizeSiteUrl("https://Example.com/blog")).toBe("https://example.com/blog/");
  });

  it("resolves allowlisted raw siteUrl", () => {
    const property = resolveAllowedProperty(testConfig, "https://example.com/blog");
    expect(property.alias).toBe("blog");
    expect(property.canonicalSiteUrl).toBe("https://example.com/blog/");
  });

  it("rejects urls outside a property", () => {
    const property = resolveAllowedProperty(testConfig, "blog");
    expect(() => assertUrlWithinProperty("https://example.com/shop/", property)).toThrowError(/outside/i);
  });

  it("allows the exact prefix root without a trailing slash", () => {
    const property = resolveAllowedProperty(testConfig, "blog");
    expect(assertUrlWithinProperty("https://example.com/blog", property).pathname).toBe("/blog");
  });
});
