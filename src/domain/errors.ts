import type { DomainErrorShape } from "./types.js";

export type DomainErrorCode =
  | "GOOGLE_ACCOUNT_NOT_LINKED"
  | "GOOGLE_PERMISSION_DENIED"
  | "GOOGLE_RESOURCE_NOT_FOUND"
  | "TOOL_DISABLED"
  | "WRITE_TOOL_DISABLED"
  | "NOT_IMPLEMENTED"
  | "WRITE_SCOPE_REQUIRED"
  | "SITE_ADD_NOT_ALLOWED"
  | "PROPERTY_NOT_ALLOWED_FOR_DELETE"
  | "PROPERTY_NOT_ALLOWED"
  | "SITE_ALIAS_NOT_FOUND"
  | "INVALID_SITE_URL"
  | "URL_OUTSIDE_PROPERTY"
  | "HIGH_CARDINALITY_RANGE_UNSAFE"
  | "TOP_ROWS_ONLY_RESULT"
  | "FRESH_DATA_INCOMPLETE"
  | "QUOTA_SHORT_TERM_EXCEEDED"
  | "QUOTA_LONG_TERM_EXCEEDED"
  | "CONFIRMATION_REQUIRED"
  | "UNSUPPORTED_INDEXING_REQUEST"
  | "INVALID_ARGUMENT"
  | "CONFIG_ERROR"
  | "AUTH_CALLBACK_FAILED"
  | "INTERNAL_ERROR";

export class DomainError extends Error implements DomainErrorShape {
  readonly code: DomainErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: DomainErrorCode,
    message: string,
    retryable = false,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }

  toJSON(): DomainErrorShape {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

export function createDomainError(
  code: DomainErrorCode,
  message: string,
  retryable = false,
  details?: Record<string, unknown>,
): DomainError {
  return new DomainError(code, message, retryable, details);
}

export function toDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) {
    return error;
  }
  if (error instanceof Error) {
    return new DomainError("INTERNAL_ERROR", error.message);
  }
  return new DomainError("INTERNAL_ERROR", "Unknown error");
}
