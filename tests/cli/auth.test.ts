import { execFile } from "node:child_process";
import path from "node:path";
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
});
