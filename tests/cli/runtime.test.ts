import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("cli runtime behavior", () => {
  it("enforces disabled tools before auth on the CLI path", async () => {
    const cwd = await makeTempProject({
      disabledTools: ["gsc.sites.list"],
    });
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const cliEntry = path.join(repoRoot, "src/cli/index.ts");
    const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");

    await expect(
      execFileAsync(tsxBin, [cliEntry, "sites", "list"], {
        cwd,
        env: {
          ...process.env,
          GOOGLE_CLIENT_ID: "test-client-id",
          GOOGLE_CLIENT_SECRET: "test-client-secret",
          GSC_MCP_DATA_DIR: cwd,
        },
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("\"code\": \"TOOL_DISABLED\""),
    });
  });

  it("rejects unsupported sourcePreference consistently before auth", async () => {
    const cwd = await makeTempProject();
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const cliEntry = path.join(repoRoot, "src/cli/index.ts");
    const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");

    await expect(
      execFileAsync(
        tsxBin,
        [
          cliEntry,
          "performance",
          "query",
          "--site",
          "main",
          "--start-date",
          "2026-01-01",
          "--end-date",
          "2026-01-02",
          "--source-preference",
          "mirror",
        ],
        {
          cwd,
          env: {
            ...process.env,
            GOOGLE_CLIENT_ID: "test-client-id",
            GOOGLE_CLIENT_SECRET: "test-client-secret",
            GSC_MCP_DATA_DIR: cwd,
          },
        },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("\"code\": \"INVALID_ARGUMENT\""),
    });
  });

  it("rejects malformed filters JSON with the same INVALID_ARGUMENT shape", async () => {
    const cwd = await makeTempProject();
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const cliEntry = path.join(repoRoot, "src/cli/index.ts");
    const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");

    await expect(
      execFileAsync(
        tsxBin,
        [
          cliEntry,
          "performance",
          "query",
          "--site",
          "main",
          "--start-date",
          "2026-01-01",
          "--end-date",
          "2026-01-02",
          "--filters-json",
          "{bad json",
        ],
        {
          cwd,
          env: {
            ...process.env,
            GOOGLE_CLIENT_ID: "test-client-id",
            GOOGLE_CLIENT_SECRET: "test-client-secret",
            GSC_MCP_DATA_DIR: cwd,
          },
        },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("\"code\": \"INVALID_ARGUMENT\""),
    });
  });

  it("blocks write commands on the CLI before auth when write policy is still disabled", async () => {
    const cwd = await makeTempProject();
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const cliEntry = path.join(repoRoot, "src/cli/index.ts");
    const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");

    await expect(
      execFileAsync(
        tsxBin,
        [
          cliEntry,
          "sites",
          "add",
          "--site-url",
          "sc-domain:example.com",
        ],
        {
          cwd,
          env: {
            ...process.env,
            GOOGLE_CLIENT_ID: "test-client-id",
            GOOGLE_CLIENT_SECRET: "test-client-secret",
            GSC_MCP_DATA_DIR: cwd,
          },
        },
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("\"code\": \"WRITE_TOOL_DISABLED\""),
    });
  });
});

async function makeTempProject(options: {
  disabledTools?: string[];
} = {}): Promise<string> {
  const cwd = path.join(os.tmpdir(), `gsc-mcp-cli-runtime-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(cwd, { recursive: true });
  const disabledTools = options.disabledTools ?? [];
  const allEnabledTools = [
    "gsc.sites.list",
    "gsc.sites.get",
    "gsc.performance.query",
    "gsc.performance.search_appearance.list",
    "gsc.url.inspect",
    "gsc.sitemaps.list",
    "gsc.sitemaps.get",
  ];
  const enabledTools = allEnabledTools.filter((tool) => !disabledTools.includes(tool));

  await writeFile(
    path.join(cwd, "gsc-mcp.config.yaml"),
    [
      "google:",
      "  defaultScope: readonly",
      "properties:",
      "  - alias: main",
      "    siteUrl: sc-domain:example.com",
      "    allowRead: true",
      "toolPolicy:",
      "  enabledTools:",
      ...enabledTools.map((tool) => `    - ${tool}`),
      ...(disabledTools.length === 0
        ? ["  disabledTools: []"]
        : ["  disabledTools:", ...disabledTools.map((tool) => `    - ${tool}`)]),
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
    ].join("\n"),
  );
  return cwd;
}
