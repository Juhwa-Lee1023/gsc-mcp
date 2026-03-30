import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("cli doctor", () => {
  it("prints local diagnostics", async () => {
    const cwd = await makeTempProject();
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const cliEntry = path.join(repoRoot, "src/cli/index.ts");
    const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");
    const result = await execFileAsync(tsxBin, [cliEntry, "doctor"], {
      cwd,
      env: {
        ...process.env,
        GOOGLE_CLIENT_ID: "test-client-id",
        GOOGLE_CLIENT_SECRET: "test-client-secret",
        GSC_MCP_DATA_DIR: cwd,
      },
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed.readOnlyDefault).toBe(true);
    expect(parsed.propertyCount).toBe(1);
  });

  it("still reports file presence when env and config are missing", async () => {
    const cwd = path.join(os.tmpdir(), `gsc-mcp-cli-missing-${Date.now()}`);
    await mkdir(cwd, { recursive: true });
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const cliEntry = path.join(repoRoot, "src/cli/index.ts");
    const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");
    const result = await execFileAsync(tsxBin, [cliEntry, "doctor"], {
      cwd,
      env: process.env,
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed.envFilePresent).toBe(false);
    expect(parsed.configFilePresent).toBe(false);
    expect(parsed.envValid).toBe(false);
    expect(parsed.configValid).toBe(false);
  });
});

async function makeTempProject(): Promise<string> {
  const cwd = path.join(os.tmpdir(), `gsc-mcp-cli-${Date.now()}`);
  await mkdir(cwd, { recursive: true });
  await writeFile(
    path.join(cwd, "gsc-mcp.config.yaml"),
    [
      "google:",
      "  defaultScope: readonly",
      "properties:",
      "  - alias: main",
      "    siteUrl: sc-domain:example.com",
      "    allowRead: true",
      "    allowWrite: false",
      "toolPolicy:",
      "  enabledTools:",
      "    - gsc.sites.list",
      "    - gsc.sites.get",
      "    - gsc.performance.query",
      "    - gsc.performance.search_appearance.list",
      "    - gsc.url.inspect",
      "    - gsc.sitemaps.list",
      "    - gsc.sitemaps.get",
      "  disabledTools:",
      "    - gsc.sites.add",
      "    - gsc.sites.delete",
      "    - gsc.sitemaps.submit",
      "    - gsc.sitemaps.delete",
      "queryPolicy:",
      "  defaultDataState: final",
      "  summaryMaxDays: 90",
      "  detailMaxDays: 31",
      "  detailSplitDailyAfterDays: 7",
      "  blockExactWithPageOrQueryWithoutBulkExport: true",
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
      "  auditLogPath: .gsc-mcp/audit/events.jsonl",
      "",
    ].join("\n"),
  );
  return cwd;
}
