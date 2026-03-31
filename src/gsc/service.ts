import { createDomainError, toDomainError } from "../domain/errors.js";
import {
  buildMetadata,
  createNextCursor,
  createPerformanceQueryPlan,
  MAX_PAGE_SIZE,
  mergeRows,
} from "../domain/planner.js";
import type {
  AppConfig,
  AuditSink,
  CacheStore,
  GscClient,
  Logger,
  PerformanceQueryIntent,
  PerformanceQueryResult,
  PerformanceRow,
  ResolvedProperty,
  SearchAnalyticsApiResponse,
  SiteRecord,
  SitemapRecord,
  ToolName,
  UrlInspectionResult,
} from "../domain/types.js";
import {
  parsePerformanceQueryInput,
  parseSearchAppearanceQueryInput,
  parseSiteSelectorInput,
  parseSitemapGetInput,
  parseUrlInspectionInput,
} from "../domain/inputs.js";
import { safeWriteAuditEvent } from "../security/audit-utils.js";
import { stableHash } from "../utils/crypto.js";
import { assertUrlWithinProperty } from "../utils/site-url.js";

function toRows(response: SearchAnalyticsApiResponse): PerformanceRow[] {
  return (response.rows ?? []).map((row) => ({
    keys: row.keys ?? [],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

function isDetailIntent(intent: Pick<PerformanceQueryIntent, "dimensions" | "filters">): boolean {
  const dimensions = intent.dimensions ?? [];
  const filters = intent.filters ?? [];
  return dimensions.includes("page") || dimensions.includes("query") || filters.some((filter) => filter.dimension === "page" || filter.dimension === "query");
}

function summarizePerformanceIntent(config: AppConfig, intent: PerformanceQueryIntent): Record<string, unknown> {
  return {
    requestClass: isDetailIntent(intent) ? "detail" : "summary",
    requestedDataState: intent.dataState ?? config.queryPolicy.defaultDataState,
    requestedAggregationType: intent.aggregationType ?? "auto",
    sourcePreference: intent.sourcePreference ?? "auto",
  };
}

function summarizePerformanceResult(result: PerformanceQueryResult): Record<string, unknown> {
  return {
    siteAlias: result.site,
    rowCount: result.rows.length,
    nextCursorPresent: result.nextCursor !== null,
    accuracyClass: result.metadata.accuracyClass,
    costClass: result.metadata.costClass,
    splitApplied: result.metadata.splitApplied,
    splitStrategy: result.metadata.splitStrategy,
    dataState: result.metadata.dataState,
    responseAggregationType: result.metadata.responseAggregationType,
  };
}

function normalizeSitemapFeedpath(feedpath: string): string {
  const trimmed = feedpath.trim();
  try {
    return new URL(trimmed).toString();
  } catch {
    return trimmed;
  }
}

export class GscService {
  private static readonly maxRangePageRequests = 200;

  constructor(
    private readonly config: AppConfig,
    private readonly client: GscClient,
    private readonly cache: CacheStore,
    private readonly cacheScope: string,
    private readonly cursorSecret: string,
    private readonly logger: Logger,
    private readonly audit: AuditSink,
    private readonly resolveProperty: (selector: string) => ResolvedProperty,
  ) {}

  async listSites(): Promise<SiteRecord[]> {
    return this.observe("gsc.sites.list", undefined, async () => {
      const { value } = await this.withCache("sites", "list", this.config.cache.sitesTtlSeconds, async () => {
        const response = await this.client.listSites();
        const allowlisted = new Map(
          this.config.properties.map((property) => [
            this.resolveProperty(property.alias).canonicalSiteUrl,
            property,
          ]),
        );

        return (response.siteEntry ?? [])
          .map((entry) => {
            const property = allowlisted.get(entry.siteUrl);
            if (!property) return null;
            const resolved = this.resolveProperty(property.alias);
            return {
              alias: property.alias,
              siteUrl: property.siteUrl,
              canonicalSiteUrl: resolved.canonicalSiteUrl,
              permissionLevel: entry.permissionLevel,
              readEnabled: property.allowRead,
            } satisfies SiteRecord;
          })
          .filter((entry): entry is SiteRecord => entry !== null);
      });
      return value;
    },
      undefined,
      (sites) => ({ siteCount: sites.length }),
    );
  }

  async getSite(selector: string): Promise<SiteRecord> {
    return this.observe("gsc.sites.get", selector, async () => {
      const property = this.assertReadable(parseSiteSelectorInput({ site: selector }).site);
      const response = await this.client.getSite(property.canonicalSiteUrl);
      return {
        alias: property.alias,
        siteUrl: property.siteUrl,
        canonicalSiteUrl: property.canonicalSiteUrl,
        permissionLevel: response.permissionLevel,
        readEnabled: property.allowRead,
      };
    }, undefined, (site) => ({
      siteAlias: site.alias,
      permissionLevel: site.permissionLevel,
    }));
  }

  async listSitemaps(selector: string): Promise<{ property: string; sitemaps: SitemapRecord[] }> {
    return this.observe("gsc.sitemaps.list", selector, async () => {
      const property = this.assertReadable(parseSiteSelectorInput({ site: selector }).site);
      const { value } = await this.withCache("sitemaps", property.canonicalSiteUrl, this.config.cache.sitemapsTtlSeconds, async () => ({
        property: property.alias,
        sitemaps: await this.client.listSitemaps(property.canonicalSiteUrl),
      }));
      return value;
    }, undefined, (result) => ({
      siteAlias: result.property,
      sitemapCount: result.sitemaps.length,
    }));
  }

  async getSitemap(selector: string, feedpath: string): Promise<{ property: string; sitemap: SitemapRecord }> {
    const input = parseSitemapGetInput({ site: selector, feedpath });
    const normalizedFeedpath = normalizeSitemapFeedpath(input.feedpath);
    return this.observe("gsc.sitemaps.get", selector, async () => {
      const property = this.assertReadable(input.site);
      const { value } = await this.withCache(
        "sitemap",
        `${property.canonicalSiteUrl}:${normalizedFeedpath}`,
        this.config.cache.sitemapsTtlSeconds,
        async () => ({
          property: property.alias,
          sitemap: await this.client.getSitemap(property.canonicalSiteUrl, normalizedFeedpath),
        }),
      );
      return value;
    }, undefined, (result) => ({
      siteAlias: result.property,
    }));
  }

  async inspectUrl(input: { site: string; url: string; forceRefresh?: boolean }): Promise<UrlInspectionResult> {
    const parsedInput = parseUrlInspectionInput(input);
    return this.observe("gsc.url.inspect", parsedInput.site, async () => {
      const property = this.assertReadable(parsedInput.site);
      const normalizedUrl = assertUrlWithinProperty(parsedInput.url, property).toString();
      const { value, cacheHit } = await this.withCache(
        "inspection",
        `${property.canonicalSiteUrl}:${normalizedUrl}`,
        this.config.cache.urlInspectionTtlSeconds,
        async () => ({
          property: property.alias,
          canonicalSiteUrl: property.canonicalSiteUrl,
          inspectionUrl: normalizedUrl,
          inspectionType: "indexed_view" as const,
          metadata: {
            cacheHit: false,
          },
          raw: await this.client.inspectUrl(property.canonicalSiteUrl, normalizedUrl),
        }),
        parsedInput.forceRefresh,
      );
      return {
        ...value,
        metadata: {
          cacheHit,
        },
      };
    }, undefined, (result) => ({
      siteAlias: result.property,
      inspectionType: result.inspectionType,
      cacheHit: result.metadata.cacheHit,
    }));
  }

  async queryPerformance(intent: PerformanceQueryIntent): Promise<PerformanceQueryResult> {
    const validatedIntent = parsePerformanceQueryInput(intent);
    return this.observe(
      "gsc.performance.query",
      validatedIntent.site,
      async () => this.queryPerformanceInternal(validatedIntent),
      summarizePerformanceIntent(this.config, validatedIntent),
      summarizePerformanceResult,
    );
  }

  async listSearchAppearance(
    input: Omit<PerformanceQueryIntent, "dimensions" | "filters" | "cursor">,
  ): Promise<PerformanceQueryResult> {
    const validatedInput = parseSearchAppearanceQueryInput(input);
    const intent: PerformanceQueryIntent = {
      ...validatedInput,
      dimensions: ["searchAppearance"],
      filters: [],
      cursor: null,
    };
    return this.observe(
      "gsc.performance.search_appearance.list",
      validatedInput.site,
      async () => this.queryPerformanceInternal(intent),
      summarizePerformanceIntent(this.config, intent),
      summarizePerformanceResult,
    );
  }

  private async queryPerformanceInternal(intent: PerformanceQueryIntent): Promise<PerformanceQueryResult> {
    const property = this.assertReadable(intent.site);
    const plan = createPerformanceQueryPlan({
      config: this.config,
      property,
      intent,
      cursorSecret: this.cursorSecret,
    });
    const ttl =
      plan.normalizedIntent.dataState === "final"
        ? this.config.cache.finalizedPerformanceTtlSeconds
        : this.config.cache.freshPerformanceTtlSeconds;

    const { value } = await this.withCache(
      "performance",
      stableHash({ property: property.canonicalSiteUrl, plan }),
      ttl,
      async () => {
        if (plan.splitStrategy === "none") {
          const response = await this.client.querySearchAnalytics(property.canonicalSiteUrl, {
            startDate: plan.resolvedStartDatePT,
            endDate: plan.resolvedEndDatePT,
            type: plan.normalizedIntent.type,
            dimensions: plan.normalizedIntent.dimensions,
            filters: plan.normalizedIntent.filters,
            aggregationType: plan.normalizedIntent.aggregationType,
            dataState: plan.normalizedIntent.dataState,
            rowLimit: plan.pageSize,
            startRow: plan.startRow,
          });
          const rows = toRows(response);
          const nextCursor =
            rows.length === plan.pageSize
              ? createNextCursor({
                  cursorSecret: this.cursorSecret,
                  requestHash: plan.requestHash,
                  startRow: plan.startRow + plan.pageSize,
                  pageSize: plan.pageSize,
                })
              : null;
          return {
            site: property.alias,
            requestEcho: plan.normalizedIntent,
            rows,
            nextCursor,
            metadata: buildMetadata({
              plan,
              responseAggregationType: response.responseAggregationType,
              firstIncompleteDate: response.metadata?.first_incomplete_date,
              firstIncompleteHour: response.metadata?.first_incomplete_hour,
              nextCursor,
            }),
          };
        }

        const responses = await this.fetchSplitResponses(property.canonicalSiteUrl, plan);
        const merged = mergeRows(
          responses.flatMap((response) =>
            toRows(response).map((row) => ({
              row,
              dimensions: plan.normalizedIntent.dimensions,
            })),
          ),
        );
        const rows = merged.slice(plan.startRow, plan.startRow + plan.pageSize);
        const nextCursor =
          merged.length > plan.startRow + plan.pageSize
            ? createNextCursor({
                cursorSecret: this.cursorSecret,
                requestHash: plan.requestHash,
                startRow: plan.startRow + plan.pageSize,
                pageSize: plan.pageSize,
              })
            : null;
        const firstIncompleteDate = responses
          .map((response) => response.metadata?.first_incomplete_date)
          .filter((value): value is string => Boolean(value))
          .sort()[0];
        const firstIncompleteHour = responses
          .map((response) => response.metadata?.first_incomplete_hour)
          .filter((value): value is string => Boolean(value))
          .sort()[0];
        const responseAggregationType = responses.find((response) => response.responseAggregationType)?.responseAggregationType;
        return {
          site: property.alias,
          requestEcho: plan.normalizedIntent,
          rows,
          nextCursor,
          metadata: buildMetadata({
            plan,
            responseAggregationType,
            firstIncompleteDate,
            firstIncompleteHour,
            nextCursor,
          }),
        };
      },
    );
    return value;
  }

  private assertReadable(selector: string): ResolvedProperty {
    const property = this.resolveProperty(selector);
    if (!property.allowRead) {
      throw createDomainError("PROPERTY_NOT_ALLOWED", `Read access is disabled for property ${property.alias}.`);
    }
    return property;
  }

  private async fetchSplitResponses(
    canonicalSiteUrl: string,
    plan: Pick<import("../domain/types.js").PerformanceQueryPlan, "dateRanges" | "normalizedIntent">,
  ): Promise<SearchAnalyticsApiResponse[]> {
    const responses: SearchAnalyticsApiResponse[] = [];
    for (const range of plan.dateRanges) {
      responses.push(...await this.fetchRangePages(canonicalSiteUrl, {
        startDate: range.startDate,
        endDate: range.endDate,
        type: plan.normalizedIntent.type,
        dimensions: plan.normalizedIntent.dimensions,
        filters: plan.normalizedIntent.filters,
        aggregationType: plan.normalizedIntent.aggregationType,
        dataState: plan.normalizedIntent.dataState,
      }));
    }
    return responses;
  }

  private async fetchRangePages(
    canonicalSiteUrl: string,
    request: Omit<Parameters<GscClient["querySearchAnalytics"]>[1], "rowLimit" | "startRow">,
  ): Promise<SearchAnalyticsApiResponse[]> {
    const responses: SearchAnalyticsApiResponse[] = [];
    for (let pageIndex = 0; pageIndex < GscService.maxRangePageRequests; pageIndex += 1) {
      const startRow = pageIndex * MAX_PAGE_SIZE;
      const response = await this.client.querySearchAnalytics(canonicalSiteUrl, {
        ...request,
        rowLimit: MAX_PAGE_SIZE,
        startRow,
      });
      responses.push(response);
      if ((response.rows?.length ?? 0) < MAX_PAGE_SIZE) {
        return responses;
      }
    }
    throw createDomainError("INTERNAL_ERROR", "Exceeded split-query pagination safety limit.");
  }

  private async withCache<T>(
    namespace: string,
    key: string,
    ttlSeconds: number,
    callback: () => Promise<T>,
    forceRefresh = false,
  ): Promise<{ value: T; cacheHit: boolean }> {
    const keyHash = stableHash({ namespace, scope: this.cacheScope, key });
    if (!this.config.cache.enabled) {
      this.logger.debug("Cache bypassed", { namespace, keyHash, reason: "disabled" });
      return {
        value: await callback(),
        cacheHit: false,
      };
    }
    const scopedKey = `${this.cacheScope}:${key}`;
    if (!forceRefresh) {
      const cached = await this.cache.get<T>(namespace, scopedKey);
      if (cached) {
        this.logger.debug("Cache hit", { namespace, keyHash });
        return {
          value: cached,
          cacheHit: true,
        };
      }
    } else {
      this.logger.debug("Cache bypassed", { namespace, keyHash, reason: "force_refresh" });
    }
    this.logger.debug("Cache miss", { namespace, keyHash });
    const computed = await callback();
    await this.cache.set(namespace, scopedKey, computed, ttlSeconds);
    this.logger.debug("Cache stored", { namespace, keyHash, ttlSeconds });
    return {
      value: computed,
      cacheHit: false,
    };
  }

  private async observe<T>(
    toolName: ToolName,
    siteSelector: string | undefined,
    callback: () => Promise<T>,
    baseDetails?: Record<string, unknown>,
    summarizeSuccess?: (result: T) => Record<string, unknown>,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await callback();
      const summary = summarizeSuccess?.(result) ?? {};
      const siteAlias = typeof summary.siteAlias === "string" ? summary.siteAlias : siteSelector;
      const { siteAlias: _summarySiteAlias, ...summaryDetails } = summary;
      const details = {
        ...baseDetails,
        latencyMs: Date.now() - startedAt,
        ...summaryDetails,
      };

      this.logger.info("Tool completed", {
        toolName,
        siteAlias,
        ...details,
      });
      await safeWriteAuditEvent(this.audit, this.logger, {
        timestamp: new Date().toISOString(),
        action: "tool.invoke",
        outcome: "success",
        toolName,
        siteAlias,
        details,
      });
      return result;
    } catch (error) {
      const domainError = toDomainError(error);
      const details = {
        ...baseDetails,
        latencyMs: Date.now() - startedAt,
        errorCode: domainError.code,
        retryable: domainError.retryable,
      };
      this.logger.warn("Tool failed", {
        toolName,
        siteAlias: siteSelector,
        ...details,
      });
      await safeWriteAuditEvent(this.audit, this.logger, {
        timestamp: new Date().toISOString(),
        action: "tool.invoke",
        outcome: "failure",
        toolName,
        siteAlias: siteSelector,
        details,
      });
      throw error;
    }
  }
}
