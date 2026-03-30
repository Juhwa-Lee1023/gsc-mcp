import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { writeJsonFileAtomic } from "../../src/utils/fs.js";

describe("fs helpers", () => {
  it("overwrites existing json files safely", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "gsc-mcp-fs-"));
    const filePath = path.join(tempDir, "state.json");

    await writeJsonFileAtomic(filePath, { version: 1 });
    await writeJsonFileAtomic(filePath, { version: 2 });

    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({ version: 2 });
  });
});
