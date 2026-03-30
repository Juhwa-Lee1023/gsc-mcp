import { access } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";

export function expandHome(inputPath: string): string {
  if (inputPath === "~") {
    return resolveHomeDir();
  }
  if (inputPath.startsWith("~/")) {
    return path.join(resolveHomeDir(), inputPath.slice(2));
  }
  return inputPath;
}

export async function findPackageRoot(startDir: string): Promise<string> {
  let currentDir = startDir;

  while (true) {
    try {
      await access(path.join(currentDir, "package.json"), constants.F_OK);
      return currentDir;
    } catch {
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        throw new Error(`Unable to locate package root from ${startDir}.`);
      }
      currentDir = parentDir;
    }
  }
}

function resolveHomeDir(): string {
  const homeDir = os.homedir();
  if (!homeDir) {
    throw new Error("Unable to determine the current home directory.");
  }
  return homeDir;
}
