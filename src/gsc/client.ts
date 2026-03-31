import { OAuth2Client } from "google-auth-library";

import { createDomainError } from "../domain/errors.js";
import type {
  GscClient,
  GscSiteEntry,
  GscSitesListResponse,
  Logger,
  SearchAnalyticsApiResponse,
  SitemapRecord,
} from "../domain/types.js";

const WEBMASTERS_BASE_URL = "https://www.googleapis.com/webmasters/v3";
const SEARCH_CONSOLE_BASE_URL = "https://searchconsole.googleapis.com/v1";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

export class GoogleSearchConsoleClient implements GscClient {
  constructor(
    private readonly oauthClient: OAuth2Client,
    private readonly logger?: Logger,
  ) {}

  async listSites(): Promise<GscSitesListResponse> {
    return this.request<GscSitesListResponse>({ label: "sites.list", url: `${WEBMASTERS_BASE_URL}/sites`, method: "GET" });
  }

  async getSite(siteUrl: string): Promise<GscSiteEntry> {
    return this.request<GscSiteEntry>({
      label: "sites.get",
      url: `${WEBMASTERS_BASE_URL}/sites/${encodeURIComponent(siteUrl)}`,
      method: "GET",
    });
  }

  async querySearchAnalytics(
    siteUrl: string,
    request: {
      startDate: string;
      endDate: string;
      type: string;
      dimensions: string[];
      filters: Array<{ dimension: string; operator: string; expression: string }>;
      aggregationType: string;
      dataState: string;
      rowLimit: number;
      startRow: number;
    },
  ): Promise<SearchAnalyticsApiResponse> {
    return this.request<SearchAnalyticsApiResponse>({
      label: "performance.query",
      url: `${WEBMASTERS_BASE_URL}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      method: "POST",
      data: {
        startDate: request.startDate,
        endDate: request.endDate,
        type: request.type,
        dimensions: request.dimensions,
        aggregationType: request.aggregationType,
        dataState: request.dataState,
        rowLimit: request.rowLimit,
        startRow: request.startRow,
        ...(request.filters.length > 0
          ? {
              dimensionFilterGroups: [
                {
                  groupType: "and",
                  filters: request.filters,
                },
              ],
            }
          : {}),
      },
    });
  }

  async inspectUrl(siteUrl: string, inspectionUrl: string): Promise<Record<string, unknown>> {
    const response = await this.request<{ inspectionResult: Record<string, unknown> }>({
      label: "url.inspect",
      url: `${SEARCH_CONSOLE_BASE_URL}/urlInspection/index:inspect`,
      method: "POST",
      data: {
        siteUrl,
        inspectionUrl,
      },
    });
    return response.inspectionResult;
  }

  async listSitemaps(siteUrl: string): Promise<SitemapRecord[]> {
    const response = await this.request<{ sitemap?: SitemapRecord[] }>({
      label: "sitemaps.list",
      url: `${WEBMASTERS_BASE_URL}/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
      method: "GET",
    });
    return response.sitemap ?? [];
  }

  async getSitemap(siteUrl: string, feedpath: string): Promise<SitemapRecord> {
    return this.request<SitemapRecord>({
      label: "sitemaps.get",
      url: `${WEBMASTERS_BASE_URL}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`,
      method: "GET",
    });
  }

  private async request<T>(options: { label: string; url: string; method: "GET" | "POST"; data?: unknown }): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
      try {
        const response = await this.oauthClient.request<T>({
          url: options.url,
          method: options.method,
          data: options.data,
          timeout: REQUEST_TIMEOUT_MS,
        });
        return response.data;
      } catch (error) {
        const domainError = mapGoogleError(error);
        if (!domainError.retryable || attempt > MAX_RETRIES) {
          throw domainError;
        }

        const retryAfterMs = parseRetryAfterMs(error);
        const delayMs = retryAfterMs ?? computeBackoffMs(attempt);
        this.logger?.warn("Retrying Google API request", {
          operation: options.label,
          attempt,
          delayMs,
          errorCode: domainError.code,
          retryAfterMs,
        });
        await wait(delayMs);
      }
    }
    throw createDomainError("INTERNAL_ERROR", "Google Search Console request exhausted retry attempts.", true);
  }
}

function computeBackoffMs(attempt: number): number {
  const jitter = Math.floor(Math.random() * 250);
  return BASE_BACKOFF_MS * 2 ** (attempt - 1) + jitter;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function parseRetryAfterMs(error: unknown): number | null {
  const retryAfter = (
    error as {
      response?: {
        headers?: Record<string, string | string[] | undefined>;
      };
    }
  )?.response?.headers?.["retry-after"];
  if (!retryAfter) {
    return null;
  }

  const rawValue = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
  if (!rawValue) {
    return null;
  }
  const numericSeconds = Number(rawValue);
  if (Number.isFinite(numericSeconds)) {
    return Math.max(0, numericSeconds * 1000);
  }
  const dateMs = Date.parse(rawValue);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
}

export function mapGoogleError(error: unknown) {
  const gaxiosError = error as
    | {
        code?: string;
        message?: string;
        response?: {
          status?: number;
          data?: unknown;
        };
      }
    | undefined;
  if (!gaxiosError || typeof gaxiosError !== "object") {
    throw error;
  }

  const status = gaxiosError.response?.status;
  const body = gaxiosError.response?.data as
    | {
        error?: {
          message?: string;
          errors?: Array<{ reason?: string }>;
        };
      }
    | undefined;
  const reason = body?.error?.errors?.[0]?.reason;
  const message = body?.error?.message ?? gaxiosError.message ?? "Google Search Console request failed.";
  const transportCode = gaxiosError.code;

  if (status === 429 || reason === "userRateLimitExceeded" || reason === "rateLimitExceeded") {
    return createDomainError("QUOTA_SHORT_TERM_EXCEEDED", message, true, {
      status,
      reason,
      transportCode,
      original: body,
    });
  }
  if (reason === "quotaExceeded") {
    return createDomainError("QUOTA_LONG_TERM_EXCEEDED", message, true, {
      status,
      reason,
      transportCode,
      original: body,
    });
  }

  if (status === 401) {
    return createDomainError("GOOGLE_ACCOUNT_NOT_LINKED", message, false, {
      status,
      reason,
      transportCode,
      original: body,
    });
  }
  if (status === 400) {
    return createDomainError("INVALID_ARGUMENT", message, false, {
      status,
      reason,
      transportCode,
      original: body,
    });
  }
  if (status === 403 || reason === "insufficientPermissions" || reason === "forbidden" || reason === "permissionDenied") {
    return createDomainError("GOOGLE_PERMISSION_DENIED", message, false, {
      status,
      reason,
      transportCode,
      original: body,
    });
  }
  if (status === 404) {
    return createDomainError("GOOGLE_RESOURCE_NOT_FOUND", message, false, {
      status,
      reason,
      transportCode,
      original: body,
    });
  }

  const retryableTransportCodes = new Set(["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "ECONNREFUSED"]);
  return createDomainError(
    "INTERNAL_ERROR",
    message,
    status === 500 || status === 502 || status === 503 || status === 504 || retryableTransportCodes.has(transportCode ?? ""),
    {
      status,
      reason,
      transportCode,
      original: body,
    },
  );
}
