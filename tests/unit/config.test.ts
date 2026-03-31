import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config/load.js";

describe("config semantics", () => {
  it("rejects tool policies that reference unimplemented tools", async () => {
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
      "    - gsc.sites.add",
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
});

async function writeTempConfig(lines: string[]): Promise<string> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "gsc-mcp-config-"));
  const configPath = path.join(cwd, "gsc-mcp.config.yaml");
  await writeFile(configPath, lines.join("\n"));
  return configPath;
}
