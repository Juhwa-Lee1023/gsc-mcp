import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SERVICE = "gsc-mcp";
const ACCOUNT = "default";

export async function loadMacosKeychain(): Promise<string | null> {
  try {
    const result = await execFileAsync("security", [
      "find-generic-password",
      "-s",
      SERVICE,
      "-a",
      ACCOUNT,
      "-w",
    ]);
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function saveMacosKeychain(payload: string): Promise<void> {
  await execFileAsync("security", [
    "add-generic-password",
    "-U",
    "-s",
    SERVICE,
    "-a",
    ACCOUNT,
    "-w",
    payload,
  ]);
}

export async function deleteMacosKeychain(): Promise<void> {
  await execFileAsync("security", [
    "delete-generic-password",
    "-s",
    SERVICE,
    "-a",
    ACCOUNT,
  ]).catch(() => undefined);
}
