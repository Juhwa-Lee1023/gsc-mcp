import { sha256 } from "../utils/crypto.js";

const TOKEN_KEYS = new Set([
  "access_token",
  "refresh_token",
  "client_secret",
  "clientSecret",
  "authorization",
]);

export function redactRecord(
  record: Record<string, unknown>,
  options?: { redactPageUrls?: boolean; redactQueryStrings?: boolean },
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, redactValue(key, value, options)]),
  );
}

function redactValue(
  key: string,
  value: unknown,
  options?: { redactPageUrls?: boolean; redactQueryStrings?: boolean },
): unknown {
  if (TOKEN_KEYS.has(key)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    if (options?.redactQueryStrings && key.toLowerCase().includes("query")) {
      return `[HASH:${sha256(value)}]`;
    }
    if (options?.redactPageUrls && key.toLowerCase().includes("page") && /^https?:\/\//.test(value)) {
      return `[HASH:${sha256(value)}]`;
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(key, entry, options));
  }

  if (value && typeof value === "object") {
    return redactRecord(value as Record<string, unknown>, options);
  }

  return value;
}
