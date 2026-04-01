import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config/load.js";

describe("config semantics", () => {
  it("rejects tool policies that reference unsupported tools", async () => {
    const configPath = await writeTempConfig([
      "google:",
      "  defaultScope: readonly",
      "properties:",
      "  - alias: main",
      "    siteUrl: sc-domain:example.com",
      "    allowRead: true",
      "toolPolicy:",
      "  enabledTools:",
      "    - gsc.sites.list",
      "    - gsc.sites.magic",
      "  disabledTools: []",
      "queryPolicy:",
      "  defaultDataState: final",
      "  summaryMaxDays: 90",
      "  detailMaxDays: 31",
      "  detailSplitDailyAfterDays: 7",
      "cache:",
      "  enabled: true",
      "  sitesTtlSeconds: 300",
      "  sitemapsTtlSeconds: 300",
      "  urlInspectionTtlSeconds: 3600",
      "  finalizedPerformanceTtlSeconds: 43200",
      "  freshPerformanceTtlSeconds: 300",
      "logging:",
      "  redactPageUrls: true",
      "  redactQueryStrings: true",
      "",
    ]);

    await expect(loadConfig(configPath)).rejects.toThrow(/Invalid config file|unimplemented tool/);
  });

  it("rejects conflicting enabled and disabled tool states", async () => {
    const configPath = await writeTempConfig([
      "google:",
      "  defaultScope: readonly",
      "properties:",
      "  - alias: main",
      "    siteUrl: sc-domain:example.com",
      "    allowRead: true",
      "toolPolicy:",
      "  enabledTools:",
      "    - gsc.sites.list",
      "  disabledTools:",
      "    - gsc.sites.list",
      "queryPolicy:",
      "  defaultDataState: final",
      "  summaryMaxDays: 90",
      "  detailMaxDays: 31",
      "  detailSplitDailyAfterDays: 7",
      "cache:",
      "  enabled: true",
      "  sitesTtlSeconds: 300",
      "  sitemapsTtlSeconds: 300",
      "  urlInspectionTtlSeconds: 3600",
      "  finalizedPerformanceTtlSeconds: 43200",
      "  freshPerformanceTtlSeconds: 300",
      "logging:",
      "  redactPageUrls: true",
      "  redactQueryStrings: true",
      "",
    ]);

    await expect(loadConfig(configPath)).rejects.toThrow(/cannot both enable and disable/i);
  });

  it("rejects enabled write policy when the write tool is not exposed by toolPolicy", async () => {
    const configPath = await writeTempConfig([
      "google:",
      "  defaultScope: readonly",
      "properties:",
      "  - alias: main",
      "    siteUrl: sc-domain:example.com",
      "    allowRead: true",
      "toolPolicy:",
      "  enabledTools:",
      "    - gsc.sites.list",
      "  disabledTools: []",
      "writePolicy:",
      "  enabled: true",
      "  allowedTools:",
      "    - gsc.sites.add",
      "  requireConfirmationForDestructive: true",
      "  siteAddAllowlist:",
      "    - sc-domain:example.com",
      "  siteAddAllowPatterns: []",
      "  siteDeleteAllowlist: []",
      "  siteDeleteAllowPatterns: []",
      "queryPolicy:",
      "  defaultDataState: final",
      "  summaryMaxDays: 90",
      "  detailMaxDays: 31",
      "  detailSplitDailyAfterDays: 7",
      "cache:",
      "  enabled: true",
      "  sitesTtlSeconds: 300",
      "  sitemapsTtlSeconds: 300",
      "  urlInspectionTtlSeconds: 3600",
      "  finalizedPerformanceTtlSeconds: 43200",
      "  freshPerformanceTtlSeconds: 300",
      "logging:",
      "  redactPageUrls: true",
      "  redactQueryStrings: true",
      "",
    ]);

    await expect(loadConfig(configPath)).rejects.toThrow(/toolPolicy does not expose it/i);
  });

  it("rejects destructive write enablement when confirmation is disabled", async () => {
    const configPath = await writeTempConfig([
      "google:",
      "  defaultScope: readonly",
      "properties:",
      "  - alias: main",
      "    siteUrl: sc-domain:example.com",
      "    allowRead: true",
      "toolPolicy:",
      "  enabledTools:",
      "    - gsc.sites.delete",
      "  disabledTools: []",
      "writePolicy:",
      "  enabled: true",
      "  allowedTools:",
      "    - gsc.sites.delete",
      "  requireConfirmationForDestructive: false",
      "  siteAddAllowlist: []",
      "  siteAddAllowPatterns: []",
      "  siteDeleteAllowlist:",
      "    - sc-domain:example.com",
      "  siteDeleteAllowPatterns: []",
      "queryPolicy:",
      "  defaultDataState: final",
      "  summaryMaxDays: 90",
      "  detailMaxDays: 31",
      "  detailSplitDailyAfterDays: 7",
      "cache:",
      "  enabled: true",
      "  sitesTtlSeconds: 300",
      "  sitemapsTtlSeconds: 300",
      "  urlInspectionTtlSeconds: 3600",
      "  finalizedPerformanceTtlSeconds: 43200",
      "  freshPerformanceTtlSeconds: 300",
      "logging:",
      "  redactPageUrls: true",
      "  redactQueryStrings: true",
      "",
    ]);

    await expect(loadConfig(configPath)).rejects.toThrow(/must stay true/i);
  });
});

async function writeTempConfig(lines: string[]): Promise<string> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "gsc-mcp-config-"));
  const configPath = path.join(cwd, "gsc-mcp.config.yaml");
  await writeFile(configPath, lines.join("\n"));
  return configPath;
}
