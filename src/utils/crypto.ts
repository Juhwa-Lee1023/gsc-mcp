import { createHash } from "node:crypto";

import { stableStringify } from "./json.js";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

export function stableHash(value: unknown): string {
  return sha256(stableStringify(value));
}
