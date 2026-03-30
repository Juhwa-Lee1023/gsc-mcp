import type { Credentials } from "google-auth-library";

export const READ_ONLY_TOOLS = [
  "gsc.sites.list",
  "gsc.sites.get",
  "gsc.performance.query",
  "gsc.performance.search_appearance.list",
  "gsc.url.inspect",
  "gsc.sitemaps.list",
  "gsc.sitemaps.get",
] as const;

export const DISABLED_WRITE_TOOLS = [
  "gsc.sites.add",
  "gsc.sites.delete",
  "gsc.sitemaps.submit",
  "gsc.sitemaps.delete",
] as const;

export type ToolName = (typeof READ_ONLY_TOOLS)[number] | (typeof DISABLED_WRITE_TOOLS)[number];
export type ScopeMode = "readonly" | "write";
export type SearchType = "web" | "image" | "video" | "news" | "discover" | "googleNews";
export type PerformanceDimension = "country" | "date" | "device" | "hour" | "page" | "query" | "searchAppearance";
export type AggregationType = "auto" | "byPage" | "byProperty";
export type DataState = "final" | "all" | "hourly_all";
export type FidelityMode = "best_effort" | "prefer_exact";
export type SourcePreference = "auto" | "live_api" | "mirror" | "bulk_export";
export type AccuracyClass = "exact" | "top_rows_only" | "fresh_incomplete" | "top_rows_and_fresh";
export type AccuracyReason =
  | "ANONYMIZED_QUERIES"
  | "TOP_ROWS_LIMIT"
  | "PAGE_OR_QUERY_DIMENSION"
  | "FRESH_DATA_STATE"
  | "API_ROW_EXPOSURE_LIMIT"
  | "AUTO_AGGREGATION";
export type CostClass = "low" | "medium" | "high" | "critical";
export type PropertyType = "domain" | "url-prefix";

export interface EnvConfig {
  googleClientId: string;
  googleClientSecret: string;
  dataDir: string;
  cacheDbPath?: string;
  debug: boolean;
  fileTokenSecret?: string;
}

export interface PropertyConfig {
  alias: string;
  siteUrl: string;
  allowRead: boolean;
  allowWrite: boolean;
}

export interface ToolPolicy {
  enabledTools: ToolName[];
  disabledTools: ToolName[];
}

export interface QueryPolicy {
  defaultDataState: DataState;
  summaryMaxDays: number;
  detailMaxDays: number;
  detailSplitDailyAfterDays: number;
  blockExactWithPageOrQueryWithoutBulkExport: boolean;
}

export interface CacheConfig {
  enabled: boolean;
  sitesTtlSeconds: number;
  sitemapsTtlSeconds: number;
  urlInspectionTtlSeconds: number;
  finalizedPerformanceTtlSeconds: number;
  freshPerformanceTtlSeconds: number;
}

export interface LoggingConfig {
  redactPageUrls: boolean;
  redactQueryStrings: boolean;
  auditLogPath?: string;
}

export interface AppConfig {
  google: {
    defaultScope: ScopeMode;
  };
  properties: PropertyConfig[];
  toolPolicy: ToolPolicy;
  queryPolicy: QueryPolicy;
  cache: CacheConfig;
  logging: LoggingConfig;
}

export interface ResolvedProperty extends PropertyConfig {
  canonicalSiteUrl: string;
  propertyType: PropertyType;
  host: string;
  prefixPath: string;
}

export interface PerformanceFilter {
  dimension: PerformanceDimension;
  operator: "contains" | "equals" | "notContains" | "notEquals" | "includingRegex" | "excludingRegex";
  expression: string;
}

export interface PerformanceQueryIntent {
  site: string;
  startDate: string;
  endDate: string;
  type?: SearchType;
  dimensions?: PerformanceDimension[];
  filters?: PerformanceFilter[];
  aggregationType?: AggregationType;
  dataState?: DataState;
  fidelity?: FidelityMode;
  sourcePreference?: SourcePreference;
  pageSize?: number;
  cursor?: string | null;
  searchType?: unknown;
}

export interface PerformanceRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PerformanceRequestEcho {
  site: string;
  canonicalSiteUrl: string;
  startDate: string;
  endDate: string;
  type: SearchType;
  dimensions: PerformanceDimension[];
  filters: PerformanceFilter[];
  aggregationType: AggregationType;
  dataState: DataState;
  fidelity: FidelityMode;
  sourcePreference: SourcePreference;
  pageSize: number;
}

export interface AccuracyMetadata {
  accuracyClass: AccuracyClass;
  reasons: AccuracyReason[];
  resolvedStartDatePT: string;
  resolvedEndDatePT: string;
  requestedAggregationType: AggregationType;
  responseAggregationType: AggregationType;
  dataState: DataState;
  firstIncompleteDate?: string;
  firstIncompleteHour?: string;
  costClass: CostClass;
  splitApplied: boolean;
}

export interface PerformanceQueryResult {
  site: string;
  requestEcho: PerformanceRequestEcho;
  rows: PerformanceRow[];
  nextCursor: string | null;
  metadata: AccuracyMetadata;
}

export interface PerformanceQueryPlan {
  property: ResolvedProperty;
  normalizedIntent: PerformanceRequestEcho;
  requestHash: string;
  resolvedStartDatePT: string;
  resolvedEndDatePT: string;
  startRow: number;
  pageSize: number;
  splitApplied: boolean;
  dateRanges: Array<{ startDate: string; endDate: string }>;
  isDetail: boolean;
  costClass: CostClass;
  predictedReasons: AccuracyReason[];
}

export interface DomainErrorShape {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface TokenRecord {
  scopeMode: ScopeMode;
  credentials: Credentials;
  createdAt: string;
  updatedAt: string;
}

export interface TokenStore {
  kind: string;
  get(): Promise<TokenRecord | null>;
  set(record: TokenRecord): Promise<void>;
  delete(): Promise<void>;
}

export interface CacheStore {
  get<T>(namespace: string, key: string): Promise<T | null>;
  set<T>(namespace: string, key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(namespace: string, key: string): Promise<void>;
  clearExpired(): Promise<void>;
  close(): Promise<void>;
}

export interface AuditEvent {
  timestamp: string;
  action: string;
  outcome: "success" | "failure";
  toolName?: ToolName;
  siteAlias?: string;
  details?: Record<string, unknown>;
}

export interface AuditSink {
  write(event: AuditEvent): Promise<void>;
}

export interface Logger {
  debug(message: string, details?: Record<string, unknown>): void;
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
  error(message: string, details?: Record<string, unknown>): void;
}

export interface GscSiteEntry {
  siteUrl: string;
  permissionLevel: string;
}

export interface GscSitesListResponse {
  siteEntry?: GscSiteEntry[];
}

export interface SearchAnalyticsApiResponse {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;
  responseAggregationType?: AggregationType;
  metadata?: {
    first_incomplete_date?: string;
    first_incomplete_hour?: string;
  };
}

export interface SitemapRecord {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  type?: string;
  warnings?: string;
  errors?: string;
}

export interface UrlInspectionResult {
  property: string;
  canonicalSiteUrl: string;
  inspectionUrl: string;
  inspectionType: "indexed_view";
  raw: Record<string, unknown>;
}

export interface GscClient {
  listSites(): Promise<GscSitesListResponse>;
  getSite(siteUrl: string): Promise<GscSiteEntry>;
  querySearchAnalytics(siteUrl: string, request: {
    startDate: string;
    endDate: string;
    type: SearchType;
    dimensions: PerformanceDimension[];
    filters: PerformanceFilter[];
    aggregationType: AggregationType;
    dataState: DataState;
    rowLimit: number;
    startRow: number;
  }): Promise<SearchAnalyticsApiResponse>;
  inspectUrl(siteUrl: string, inspectionUrl: string): Promise<Record<string, unknown>>;
  listSitemaps(siteUrl: string): Promise<SitemapRecord[]>;
  getSitemap(siteUrl: string, feedpath: string): Promise<SitemapRecord>;
}

export interface SiteRecord {
  alias: string;
  siteUrl: string;
  canonicalSiteUrl: string;
  permissionLevel: string;
  readEnabled: boolean;
  writeEnabled: boolean;
}

export interface RuntimeContext {
  env: EnvConfig;
  config: AppConfig;
  properties: ResolvedProperty[];
  logger: Logger;
  audit: AuditSink;
  tokenStore: TokenStore;
  cache: CacheStore;
  cursorSigningSecret: string;
}
