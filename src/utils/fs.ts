import { access, appendFile, chmod, copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function writeJsonFileAtomic(filePath: string, value: unknown, mode = 0o600): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, JSON.stringify(value, null, 2), { mode });
  await rename(tempPath, filePath);
}

export async function appendJsonLine(filePath: string, value: unknown, mode = 0o600): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await appendFile(filePath, `${JSON.stringify(value)}\n`, { mode });
}

export async function copyIfMissing(
  sourcePath: string,
  destinationPath: string,
  options: {
    mode?: number;
  } = {},
): Promise<boolean> {
  if (await fileExists(destinationPath)) {
    return false;
  }
  await ensureDir(path.dirname(destinationPath));
  await copyFile(sourcePath, destinationPath);
  if (options.mode !== undefined) {
    await chmod(destinationPath, options.mode);
  }
  return true;
}
