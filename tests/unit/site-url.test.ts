import { describe, expect, it } from "vitest";

import { testConfig } from "../helpers.js";
import { assertUrlWithinProperty, findConfiguredProperty, matchesSiteUrlPolicy, normalizeSiteUrl, resolveAllowedProperty } from "../../src/utils/site-url.js";

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

  it("prefers an exact siteUrl match over an alias collision", () => {
    const config = {
      ...testConfig,
      properties: [
        ...testConfig.properties,
        {
          alias: "sc-domain:example.com",
          siteUrl: "https://example.com/",
          allowRead: true,
        },
      ],
    };

    const property = findConfiguredProperty(config, "sc-domain:example.com");
    expect(property?.alias).toBe("main");
    expect(property?.canonicalSiteUrl).toBe("sc-domain:example.com");
  });

  it("matches wildcard site-url policies without overmatching", () => {
    expect(matchesSiteUrlPolicy("https://example.com/blog/", [], ["https://example.com/*"])).toBe(true);
    expect(matchesSiteUrlPolicy("sc-domain:team.example.com", [], ["sc-domain:*.example.com"])).toBe(true);
    expect(matchesSiteUrlPolicy("https://example.org/blog/", [], ["https://example.com/*"])).toBe(false);
  });
});
