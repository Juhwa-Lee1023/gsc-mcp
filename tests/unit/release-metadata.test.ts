import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("release metadata", () => {
  it("declares package metadata needed for a public beta repo", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.license).toBe("UNLICENSED");
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/Juhwa-Lee1023/gsc-mcp.git",
    });
    expect(packageJson.bugs).toEqual({
      url: "https://github.com/Juhwa-Lee1023/gsc-mcp/issues",
    });
    expect(packageJson.homepage).toBe("https://github.com/Juhwa-Lee1023/gsc-mcp#readme");
    expect(packageJson.files).toContain("LICENSE");
  });

  it("includes a license file and CI workflow", async () => {
    await expect(access(path.join(repoRoot, "LICENSE"))).resolves.toBeUndefined();
    await expect(access(path.join(repoRoot, ".github", "workflows", "ci.yml"))).resolves.toBeUndefined();
  });
});
