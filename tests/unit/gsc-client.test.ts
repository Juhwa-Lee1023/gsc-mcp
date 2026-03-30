import { describe, expect, it } from "vitest";

import { mapGoogleError } from "../../src/gsc/client.js";

describe("google client error mapping", () => {
  it("maps permission errors and preserves original details", () => {
    const error = mapGoogleError({
      message: "Forbidden",
      response: {
        status: 403,
        data: {
          error: {
            message: "Missing permission",
            errors: [{ reason: "insufficientPermissions" }],
          },
        },
      },
    });

    expect(error).toMatchObject({
      code: "GOOGLE_PERMISSION_DENIED",
      retryable: false,
      details: {
        status: 403,
        reason: "insufficientPermissions",
        original: {
          error: {
            message: "Missing permission",
            errors: [{ reason: "insufficientPermissions" }],
          },
        },
      },
    });
  });

  it("prefers quota mapping for 403 rate-limit responses", () => {
    const error = mapGoogleError({
      message: "Slow down",
      response: {
        status: 403,
        data: {
          error: {
            message: "Rate limit exceeded",
            errors: [{ reason: "rateLimitExceeded" }],
          },
        },
      },
    });

    expect(error).toMatchObject({
      code: "QUOTA_SHORT_TERM_EXCEEDED",
      retryable: true,
      details: {
        status: 403,
        reason: "rateLimitExceeded",
      },
    });
  });

  it("maps not-found errors and preserves the original payload", () => {
    const error = mapGoogleError({
      response: {
        status: 404,
        data: {
          error: {
            message: "Not found",
            errors: [{ reason: "notFound" }],
          },
        },
      },
    });

    expect(error).toMatchObject({
      code: "GOOGLE_RESOURCE_NOT_FOUND",
      retryable: false,
      details: {
        status: 404,
        reason: "notFound",
        original: {
          error: {
            message: "Not found",
            errors: [{ reason: "notFound" }],
          },
        },
      },
    });
  });

  it("marks transient transport failures as retryable", () => {
    const error = mapGoogleError({
      code: "ETIMEDOUT",
      message: "timeout",
    });

    expect(error).toMatchObject({
      code: "INTERNAL_ERROR",
      retryable: true,
      details: {
        transportCode: "ETIMEDOUT",
      },
    });
  });
});
