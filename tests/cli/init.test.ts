import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("cli init", () => {
  it("copies starter templates from the package directory into the current project", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "gsc-mcp-init-"));
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const cliEntry = path.join(repoRoot, "src/cli/index.ts");
    const tsxBin = path.join(repoRoot, "node_modules/.bin/tsx");

    const result = await execFileAsync(tsxBin, [cliEntry, "init"], {
      cwd,
      env: process.env,
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed.envCreated).toBe(true);
    expect(parsed.configCreated).toBe(true);
    expect(await readFile(path.join(cwd, ".env"), "utf8")).toContain("GOOGLE_CLIENT_ID=");
    expect(await readFile(path.join(cwd, "gsc-mcp.config.yaml"), "utf8")).toContain("defaultScope: readonly");

    const envMode = (await stat(path.join(cwd, ".env"))).mode & 0o777;
    expect(envMode).toBe(0o600);
  });
});
