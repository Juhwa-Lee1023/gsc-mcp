import { describe, expect, it } from "vitest";

import { GoogleSearchConsoleClient, mapGoogleError } from "../../src/gsc/client.js";

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

  it("uses bodyless PUT/DELETE requests for official Search Console writes", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = new GoogleSearchConsoleClient({
      request: async (options: Record<string, unknown>) => {
        calls.push(options);
        return { data: undefined };
      },
    } as never);

    await client.addSite("sc-domain:example.com");
    await client.deleteSite("sc-domain:example.com");
    await client.submitSitemap("https://example.com/", "https://example.com/sitemap.xml");
    await client.deleteSitemap("https://example.com/", "https://example.com/sitemap.xml");

    expect(calls).toHaveLength(4);
    expect(calls).toEqual([
      expect.objectContaining({
        method: "PUT",
        url: expect.stringContaining("/sites/sc-domain%3Aexample.com"),
        data: undefined,
      }),
      expect.objectContaining({
        method: "DELETE",
        url: expect.stringContaining("/sites/sc-domain%3Aexample.com"),
        data: undefined,
      }),
      expect.objectContaining({
        method: "PUT",
        url: expect.stringContaining("/sites/https%3A%2F%2Fexample.com%2F/sitemaps/https%3A%2F%2Fexample.com%2Fsitemap.xml"),
        data: undefined,
      }),
      expect.objectContaining({
        method: "DELETE",
        url: expect.stringContaining("/sites/https%3A%2F%2Fexample.com%2F/sitemaps/https%3A%2F%2Fexample.com%2Fsitemap.xml"),
        data: undefined,
      }),
    ]);
  });

  it("does not retry write requests when a retryable error occurs", async () => {
    let attempts = 0;
    const client = new GoogleSearchConsoleClient({
      request: async () => {
        attempts += 1;
        throw {
          message: "temporary outage",
          response: {
            status: 503,
            data: {
              error: {
                message: "temporary outage",
              },
            },
          },
        };
      },
    } as never);

    await expect(client.deleteSite("sc-domain:example.com")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      retryable: true,
    });
    expect(attempts).toBe(1);
  });
});
