import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("release metadata", () => {
  it("declares package metadata needed for a public beta repo", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.version).toBe("0.1.0-beta.1");
    expect(packageJson.license).toBe("MIT");
    expect(packageJson.description).toContain("read-only");
    expect(packageJson.description).toContain("CLI/MCP");
    expect(packageJson.description).toContain("inspector");
    expect(packageJson.description).toContain("official writes");
    expect(packageJson.publishConfig).toEqual({ access: "public" });
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
    expect(packageJson.scripts["pack:check"]).toBe("node scripts/check-package.mjs");
    expect(packageJson.scripts["runtime:smoke"]).toBe("node scripts/runtime-smoke.mjs");
    expect(packageJson.scripts["release:check"]).toBe("pnpm check && pnpm runtime:smoke && pnpm pack:check");
  });

  it("includes a license file and CI workflow", async () => {
    await expect(access(path.join(repoRoot, "LICENSE"))).resolves.toBeUndefined();
    await expect(access(path.join(repoRoot, ".github", "workflows", "ci.yml"))).resolves.toBeUndefined();
    await expect(access(path.join(repoRoot, "RELEASING.md"))).resolves.toBeUndefined();
    await expect(access(path.join(repoRoot, "pnpm-workspace.yaml"))).resolves.toBeUndefined();
    await expect(access(path.join(repoRoot, "scripts", "runtime-smoke.mjs"))).resolves.toBeUndefined();
  });

  it("uses a public-package license text instead of a private evaluation-only notice", async () => {
    const license = await readFile(path.join(repoRoot, "LICENSE"), "utf8");

    expect(license).toContain("MIT License");
    expect(license).toContain("Permission is hereby granted");
    expect(license).not.toContain("No license is granted");
  });

  it("keeps release docs and CI aligned with the narrowed beta surface", async () => {
    const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");
    const workflow = await readFile(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
    const releasing = await readFile(path.join(repoRoot, "RELEASING.md"), "utf8");
    const workspace = await readFile(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");

    expect(readme).toContain("not a broad Search Console management suite");
    expect(readme).toContain("not consumed as a supported importable library API");
    expect(readme).toContain("live API only");
    expect(readme).toContain("sites.add");
    expect(readme).toContain("sitemaps.submit");
    expect(readme).toContain("ownership verification");
    expect(readme).toContain("pnpm-workspace.yaml");
    expect(readme).toContain("pnpm runtime:smoke");
    expect(readme).toContain("pnpm pack --pack-destination .tmp/pkg");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm typecheck");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("pnpm build");
    expect(workflow).toContain("node dist/index.js --help");
    expect(workflow).toContain("node dist/index.js auth status");
    expect(workflow).toContain("pnpm runtime:smoke");
    expect(workflow).toContain("pnpm pack:check");
    expect(releasing).toContain("pnpm release:check");
    expect(releasing).toContain("pnpm runtime:smoke");
    expect(releasing).toContain("pnpm publish --tag beta --access public");
    expect(releasing).toContain("0.1.0-beta.1");
    expect(releasing).toContain("not a generic importable library");
    expect(releasing).toContain("sites.add");
    expect(releasing).toContain("destructive writes still require server-side confirmation");
    expect(releasing).toContain("package license still grants public use and redistribution rights");
    expect(releasing).toContain("repository, homepage, and issue tracker URLs");
    expect(workspace).toContain("better-sqlite3");
    expect(workspace).toContain("esbuild");
  });
});
