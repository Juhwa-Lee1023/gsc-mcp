import { createHmac } from "node:crypto";

import { createDomainError } from "../domain/errors.js";

export interface CursorPayload {
  version: 1;
  requestHash: string;
  startRow: number;
  pageSize: number;
  signature: string;
}

export function encodeCursor(
  secret: string,
  payload: Omit<CursorPayload, "signature">,
): string {
  const signature = sign(secret, payload);
  return Buffer.from(JSON.stringify({ ...payload, signature }), "utf8").toString("base64url");
}

export function decodeCursor(secret: string, cursor: string): CursorPayload {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorPayload;
    const payload = {
      version: decoded.version,
      requestHash: decoded.requestHash,
      startRow: decoded.startRow,
      pageSize: decoded.pageSize,
    };
    if (decoded.version !== 1 || sign(secret, payload) !== decoded.signature) {
      throw new Error("Cursor signature mismatch");
    }
    return decoded;
  } catch {
    throw createDomainError("INVALID_ARGUMENT", "Invalid pagination cursor.");
  }
}

function sign(secret: string, payload: Omit<CursorPayload, "signature">): string {
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("base64url");
}
