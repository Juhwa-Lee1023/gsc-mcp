import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("release metadata", () => {
  it("declares package metadata needed for a public beta repo", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.license).toBe("SEE LICENSE IN LICENSE");
    expect(packageJson.description).toContain("read-only");
    expect(packageJson.description).toContain("inspector");
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/Juhwa-Lee1023/gsc-mcp.git",
    });
    expect(packageJson.bugs).toEqual({
      url: "https://github.com/Juhwa-Lee1023/gsc-mcp/issues",
    });
    expect(packageJson.homepage).toBe("https://github.com/Juhwa-Lee1023/gsc-mcp#readme");
    expect(packageJson.files).toContain("LICENSE");
    expect(packageJson.files).not.toContain("gsc-mcp-dev-pack-2026-03-30");
  });

  it("includes a license file and CI workflow", async () => {
    await expect(access(path.join(repoRoot, "LICENSE"))).resolves.toBeUndefined();
    await expect(access(path.join(repoRoot, ".github", "workflows", "ci.yml"))).resolves.toBeUndefined();
  });

  it("keeps release docs and CI aligned with the narrowed beta surface", async () => {
    const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");
    const workflow = await readFile(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");

    expect(readme).toContain("not a broad Search Console management suite");
    expect(readme).toContain("live API only");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm typecheck");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("pnpm build");
    expect(workflow).toContain("node dist/index.js auth status");
  });
});
