import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("cli auth", () => {
  it("rejects unsupported scope values before starting auth", async () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const cliEntry = path.join(repoRoot, "src/cli/index.ts");
    const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");

    await expect(
      execFileAsync(tsxBin, [cliEntry, "auth", "login", "--scope", "nope"], {
        cwd: repoRoot,
        env: process.env,
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Allowed choices are readonly, write."),
    });
  });

  it("reports auth status with env only and no app config", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gsc-mcp-auth-status-"));
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const cliEntry = path.join(repoRoot, "src/cli/index.ts");
    const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");

    const result = await execFileAsync(tsxBin, [cliEntry, "auth", "status"], {
      cwd,
      env: {
        ...process.env,
        GSC_MCP_DATA_DIR: cwd,
      },
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed.linked).toBe(false);
    expect(parsed.tokenStore).toBeTruthy();
  });

  it("works from the built CLI artifact for auth status", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gsc-mcp-auth-dist-"));
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

    await execFileAsync("pnpm", ["build"], {
      cwd: repoRoot,
      env: process.env,
    });

    const result = await execFileAsync("node", [path.join(repoRoot, "dist/index.js"), "auth", "status"], {
      cwd,
      env: {
        ...process.env,
        GSC_MCP_DATA_DIR: cwd,
      },
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed.linked).toBe(false);
  });

  it("prints help from the built CLI artifact", async () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

    await execFileAsync("pnpm", ["build"], {
      cwd: repoRoot,
      env: process.env,
    });

    const result = await execFileAsync("node", [path.join(repoRoot, "dist/index.js"), "--help"], {
      cwd: repoRoot,
      env: process.env,
    });

    expect(result.stdout).toContain("Search Console inspector");
    expect(result.stdout).toContain("serve");
    expect(result.stdout).toContain("auth");
  });

  it("logs out with env only and no app config", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gsc-mcp-auth-logout-"));
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const cliEntry = path.join(repoRoot, "src/cli/index.ts");
    const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");

    const result = await execFileAsync(tsxBin, [cliEntry, "auth", "logout"], {
      cwd,
      env: {
        ...process.env,
        GSC_MCP_DATA_DIR: cwd,
      },
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed).toEqual({
      tokenStore: expect.any(String),
      linked: false,
      removed: false,
    });
  });
});
