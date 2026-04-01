import { describe, expect, it } from "vitest";

import { parsePackOutput } from "../../scripts/check-package.mjs";

describe("package check parser", () => {
  it("parses npm pack json after noisy prepack logs", () => {
    const raw = [
      "\u001B[34mCLI\u001B[39m Building entry: src/cli/index.ts",
      "\u001B[34mCLI\u001B[39m tsup v8.4.0",
      JSON.stringify([
        {
          name: "gsc-mcp",
          version: "0.1.0-beta.1",
          entryCount: 1,
          files: [{ path: "dist/index.js" }],
        },
      ]),
    ].join("\n");

    expect(parsePackOutput(raw)).toEqual([
      {
        name: "gsc-mcp",
        version: "0.1.0-beta.1",
        entryCount: 1,
        files: [{ path: "dist/index.js" }],
      },
    ]);
  });

  it("fails clearly when npm pack does not emit json", () => {
    expect(() => parsePackOutput("tsup build output only")).toThrow("Could not parse npm pack JSON output.");
  });
});
