import { createDomainError } from "../domain/errors.js";
import {
  buildMetadata,
  createNextCursor,
  createPerformanceQueryPlan,
  MAX_PAGE_SIZE,
  mergeRows,
} from "../domain/planner.js";
import type {
  AppConfig,
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
  UrlInspectionResult,
} from "../domain/types.js";
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

export class GscService {
  constructor(
    private readonly config: AppConfig,
    private readonly client: GscClient,
    private readonly cache: CacheStore,
    private readonly cursorSecret: string,
    private readonly logger: Logger,
    private readonly resolveProperty: (selector: string) => ResolvedProperty,
  ) {}

  async listSites(): Promise<SiteRecord[]> {
    return this.withCache("sites", "list", this.config.cache.sitesTtlSeconds, async () => {
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
            writeEnabled: property.allowWrite,
          } satisfies SiteRecord;
        })
        .filter((entry): entry is SiteRecord => entry !== null);
    });
  }

  async getSite(selector: string): Promise<SiteRecord> {
    const property = this.assertReadable(selector);
    const response = await this.client.getSite(property.canonicalSiteUrl);
    return {
      alias: property.alias,
      siteUrl: property.siteUrl,
      canonicalSiteUrl: property.canonicalSiteUrl,
      permissionLevel: response.permissionLevel,
      readEnabled: property.allowRead,
      writeEnabled: property.allowWrite,
    };
  }

  async listSitemaps(selector: string): Promise<{ property: string; sitemaps: SitemapRecord[] }> {
    const property = this.assertReadable(selector);
    return this.withCache("sitemaps", property.canonicalSiteUrl, this.config.cache.sitemapsTtlSeconds, async () => ({
      property: property.alias,
      sitemaps: await this.client.listSitemaps(property.canonicalSiteUrl),
    }));
  }

  async getSitemap(selector: string, feedpath: string): Promise<{ property: string; sitemap: SitemapRecord }> {
    const property = this.assertReadable(selector);
    return {
      property: property.alias,
      sitemap: await this.client.getSitemap(property.canonicalSiteUrl, feedpath),
    };
  }

  async inspectUrl(selector: string, inspectionUrl: string): Promise<UrlInspectionResult> {
    const property = this.assertReadable(selector);
    const normalizedUrl = assertUrlWithinProperty(inspectionUrl, property).toString();
    return this.withCache(
      "inspection",
      `${property.canonicalSiteUrl}:${normalizedUrl}`,
      this.config.cache.urlInspectionTtlSeconds,
      async () => ({
        property: property.alias,
        canonicalSiteUrl: property.canonicalSiteUrl,
        inspectionUrl: normalizedUrl,
        inspectionType: "indexed_view",
        raw: await this.client.inspectUrl(property.canonicalSiteUrl, normalizedUrl),
      }),
    );
  }

  async queryPerformance(intent: PerformanceQueryIntent): Promise<PerformanceQueryResult> {
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

    return this.withCache(
      "performance",
      stableHash({ property: property.canonicalSiteUrl, plan }),
      ttl,
      async () => {
        if (!plan.splitApplied) {
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

        const responses = await Promise.all(
          plan.dateRanges.map((range) =>
            this.client.querySearchAnalytics(property.canonicalSiteUrl, {
              startDate: range.startDate,
              endDate: range.endDate,
              type: plan.normalizedIntent.type,
              dimensions: plan.normalizedIntent.dimensions,
              filters: plan.normalizedIntent.filters,
              aggregationType: plan.normalizedIntent.aggregationType,
              dataState: plan.normalizedIntent.dataState,
              rowLimit: MAX_PAGE_SIZE,
              startRow: 0,
            }),
          ),
        );

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
  }

  async listSearchAppearance(
    input: Omit<PerformanceQueryIntent, "dimensions" | "filters" | "cursor">,
  ): Promise<PerformanceQueryResult> {
    return this.queryPerformance({
      ...input,
      dimensions: ["searchAppearance"],
      filters: [],
      cursor: null,
    });
  }

  private assertReadable(selector: string): ResolvedProperty {
    const property = this.resolveProperty(selector);
    if (!property.allowRead) {
      throw createDomainError("PROPERTY_NOT_ALLOWED", `Read access is disabled for property ${property.alias}.`);
    }
    return property;
  }

  private async withCache<T>(namespace: string, key: string, ttlSeconds: number, callback: () => Promise<T>): Promise<T> {
    if (!this.config.cache.enabled) {
      return callback();
    }
    const cached = await this.cache.get<T>(namespace, key);
    if (cached) {
      return cached;
    }
    const computed = await callback();
    await this.cache.set(namespace, key, computed, ttlSeconds);
    return computed;
  }
}
