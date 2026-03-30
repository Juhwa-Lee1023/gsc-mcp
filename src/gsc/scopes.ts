import type { ScopeMode } from "../domain/types.js";

export const GOOGLE_SCOPES: Record<ScopeMode, string> = {
  readonly: "https://www.googleapis.com/auth/webmasters.readonly",
  write: "https://www.googleapis.com/auth/webmasters",
};
