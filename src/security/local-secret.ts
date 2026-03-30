import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ensureDir, fileExists } from "../utils/fs.js";

export async function loadOrCreateSecret(options: {
  secretPath: string;
  configuredSecret?: string;
}): Promise<string> {
  if (options.configuredSecret) {
    return options.configuredSecret;
  }

  if (await fileExists(options.secretPath)) {
    return (await readFile(options.secretPath, "utf8")).trim();
  }

  const secret = randomBytes(32).toString("base64url");
  await ensureDir(path.dirname(options.secretPath));
  await writeFile(options.secretPath, `${secret}\n`, { mode: 0o600 });
  return secret;
}
