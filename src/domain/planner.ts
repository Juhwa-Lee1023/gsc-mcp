import { createDomainError } from "./errors.js";
import type {
  AccuracyClass,
  AccuracyMetadata,
  AccuracyReason,
  AggregationType,
  AppConfig,
  CostClass,
  PerformanceDimension,
  PerformanceQueryIntent,
  PerformanceQueryPlan,
  PerformanceRequestEcho,
  ResolvedProperty,
} from "./types.js";
import { decodeCursor, encodeCursor } from "../utils/cursor.js";
import { stableHash } from "../utils/crypto.js";
import { diffDaysInclusive, enumeratePtDates, normalizePtDate } from "../utils/time.js";

export const DEFAULT_PAGE_SIZE = 1000;
export const MAX_PAGE_SIZE = 25_000;

function normalizePageSize(pageSize?: number): number {
  if (pageSize === undefined) {
    return DEFAULT_PAGE_SIZE;
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw createDomainError("INVALID_ARGUMENT", `pageSize must be between 1 and ${MAX_PAGE_SIZE}.`);
  }
  return pageSize;
}

function normalizeIntent(intent: PerformanceQueryIntent, property: ResolvedProperty, config: AppConfig): PerformanceRequestEcho {
  return {
    site: property.alias,
    canonicalSiteUrl: property.canonicalSiteUrl,
    startDate: normalizePtDate(intent.startDate),
    endDate: normalizePtDate(intent.endDate),
    type: intent.type ?? "web",
    dimensions: intent.dimensions ?? [],
    filters: intent.filters ?? [],
    aggregationType: intent.aggregationType ?? "auto",
    dataState: intent.dataState ?? config.queryPolicy.defaultDataState,
    fidelity: intent.fidelity ?? "best_effort",
    sourcePreference: intent.sourcePreference ?? "auto",
    pageSize: normalizePageSize(intent.pageSize),
  };
}

function isDetailQuery(intent: PerformanceRequestEcho): boolean {
  return (
    intent.dimensions.includes("page") ||
    intent.dimensions.includes("query") ||
    intent.filters.some((filter) => filter.dimension === "page" || filter.dimension === "query")
  );
}

function classifyCost(isDetail: boolean, dayCount: number): CostClass {
  if (!isDetail) {
    if (dayCount <= 7) return "low";
    if (dayCount <= 31) return "medium";
    return "high";
  }
  if (dayCount <= 7) return "medium";
  if (dayCount <= 14) return "high";
  return "critical";
}

function predictReasons(intent: PerformanceRequestEcho, isDetail: boolean): AccuracyReason[] {
  const reasons = new Set<AccuracyReason>();
  if (isDetail) {
    reasons.add("PAGE_OR_QUERY_DIMENSION");
    reasons.add("API_ROW_EXPOSURE_LIMIT");
    if (intent.dimensions.includes("query") || intent.filters.some((filter) => filter.dimension === "query")) {
      reasons.add("ANONYMIZED_QUERIES");
    }
  }
  if (intent.dataState !== "final") {
    reasons.add("FRESH_DATA_STATE");
  }
  if (intent.aggregationType === "auto") {
    reasons.add("AUTO_AGGREGATION");
  }
  return [...reasons];
}

export function createPerformanceQueryPlan(args: {
  config: AppConfig;
  property: ResolvedProperty;
  intent: PerformanceQueryIntent;
  cursorSecret: string;
}): PerformanceQueryPlan {
  const { config, property, intent, cursorSecret } = args;
  if (intent.searchType !== undefined) {
    throw createDomainError("INVALID_ARGUMENT", "Use `type` instead of deprecated `searchType`.");
  }

  const normalizedIntent = normalizeIntent(intent, property, config);
  if (normalizedIntent.dimensions.includes("searchAppearance")) {
    const isFirstStepAppearanceQuery =
      normalizedIntent.dimensions.length === 1 &&
      normalizedIntent.dimensions[0] === "searchAppearance" &&
      normalizedIntent.filters.length === 0;
    if (!isFirstStepAppearanceQuery) {
      throw createDomainError(
        "INVALID_ARGUMENT",
        "Use `gsc.performance.search_appearance.list` for the first-step appearance query, then filter `gsc.performance.query` by `searchAppearance`.",
      );
    }
  }
  const dayCount = diffDaysInclusive(normalizedIntent.startDate, normalizedIntent.endDate);
  const detail = isDetailQuery(normalizedIntent);

  if (
    normalizedIntent.aggregationType === "byProperty" &&
    (normalizedIntent.dimensions.includes("page") ||
      normalizedIntent.filters.some((filter) => filter.dimension === "page"))
  ) {
    throw createDomainError("INVALID_ARGUMENT", "Property aggregation cannot be used with page grouping or filtering.");
  }

  if (normalizedIntent.dimensions.includes("hour") && normalizedIntent.dataState !== "hourly_all") {
    throw createDomainError("INVALID_ARGUMENT", "The `hour` dimension requires `dataState=hourly_all`.");
  }

  const maxDays = detail ? config.queryPolicy.detailMaxDays : config.queryPolicy.summaryMaxDays;
  if (dayCount > maxDays) {
    throw createDomainError(
      "HIGH_CARDINALITY_RANGE_UNSAFE",
      `Requested range exceeds safe live API limits (${maxDays} days).`,
    );
  }

  if (
    detail &&
    normalizedIntent.fidelity === "prefer_exact" &&
    config.queryPolicy.blockExactWithPageOrQueryWithoutBulkExport &&
    normalizedIntent.sourcePreference !== "bulk_export" &&
    normalizedIntent.sourcePreference !== "mirror" &&
    dayCount > config.queryPolicy.detailSplitDailyAfterDays
  ) {
    throw createDomainError(
      "HIGH_CARDINALITY_RANGE_UNSAFE",
      "Exact long-range page/query detail requires a mirror or bulk export source.",
    );
  }

  const requestHash = stableHash({
    site: property.canonicalSiteUrl,
    request: normalizedIntent,
  });

  let startRow = 0;
  if (intent.cursor) {
    const cursor = decodeCursor(cursorSecret, intent.cursor);
    if (cursor.requestHash !== requestHash) {
      throw createDomainError("INVALID_ARGUMENT", "Cursor does not match the current query shape.");
    }
    if (cursor.pageSize !== normalizedIntent.pageSize) {
      throw createDomainError("INVALID_ARGUMENT", "Cursor page size does not match the current request.");
    }
    startRow = cursor.startRow;
  }

  const splitApplied = detail && dayCount > config.queryPolicy.detailSplitDailyAfterDays;
  return {
    property,
    normalizedIntent,
    requestHash,
    resolvedStartDatePT: normalizedIntent.startDate,
    resolvedEndDatePT: normalizedIntent.endDate,
    startRow,
    pageSize: normalizedIntent.pageSize,
    splitApplied,
    dateRanges: splitApplied
      ? enumeratePtDates(normalizedIntent.startDate, normalizedIntent.endDate).map((date) => ({
          startDate: date,
          endDate: date,
        }))
      : [
          {
            startDate: normalizedIntent.startDate,
            endDate: normalizedIntent.endDate,
          },
        ],
    isDetail: detail,
    costClass: classifyCost(detail, dayCount),
    predictedReasons: predictReasons(normalizedIntent, detail),
  };
}

export function createNextCursor(args: {
  cursorSecret: string;
  requestHash: string;
  startRow: number;
  pageSize: number;
}): string {
  return encodeCursor(args.cursorSecret, {
    version: 1,
    requestHash: args.requestHash,
    startRow: args.startRow,
    pageSize: args.pageSize,
  });
}

export function buildMetadata(args: {
  plan: PerformanceQueryPlan;
  responseAggregationType?: AggregationType;
  firstIncompleteDate?: string;
  firstIncompleteHour?: string;
  nextCursor: string | null;
}): AccuracyMetadata {
  const reasons = new Set<AccuracyReason>(args.plan.predictedReasons);
  if (args.nextCursor) {
    reasons.add("TOP_ROWS_LIMIT");
  }
  if (args.firstIncompleteDate || args.firstIncompleteHour) {
    reasons.add("FRESH_DATA_STATE");
  }

  return {
    accuracyClass: classifyAccuracyClass(reasons),
    reasons: [...reasons],
    resolvedStartDatePT: args.plan.resolvedStartDatePT,
    resolvedEndDatePT: args.plan.resolvedEndDatePT,
    requestedAggregationType: args.plan.normalizedIntent.aggregationType,
    responseAggregationType: args.responseAggregationType ?? args.plan.normalizedIntent.aggregationType,
    dataState: args.plan.normalizedIntent.dataState,
    firstIncompleteDate: args.firstIncompleteDate,
    firstIncompleteHour: args.firstIncompleteHour,
    costClass: args.plan.costClass,
    splitApplied: args.plan.splitApplied,
  };
}

function classifyAccuracyClass(reasons: Set<AccuracyReason>): AccuracyClass {
  const topRows = reasons.has("PAGE_OR_QUERY_DIMENSION") || reasons.has("TOP_ROWS_LIMIT") || reasons.has("API_ROW_EXPOSURE_LIMIT");
  const fresh = reasons.has("FRESH_DATA_STATE");
  if (topRows && fresh) return "top_rows_and_fresh";
  if (topRows) return "top_rows_only";
  if (fresh) return "fresh_incomplete";
  return "exact";
}

export function mergeRows(
  rows: Array<{ row: import("./types.js").PerformanceRow; dimensions: PerformanceDimension[] }>,
): import("./types.js").PerformanceRow[] {
  const merged = new Map<string, { row: import("./types.js").PerformanceRow; weightedPosition: number }>();

  for (const { row } of rows) {
    const key = JSON.stringify(row.keys);
    const existing = merged.get(key);
    const weightedPosition = row.position * Math.max(row.impressions, 1);
    if (!existing) {
      merged.set(key, {
        row: { ...row },
        weightedPosition,
      });
      continue;
    }

    existing.row.clicks += row.clicks;
    existing.row.impressions += row.impressions;
    existing.weightedPosition += weightedPosition;
    existing.row.ctr = existing.row.impressions === 0 ? 0 : existing.row.clicks / existing.row.impressions;
    existing.row.position = existing.weightedPosition / Math.max(existing.row.impressions, 1);
  }

  return [...merged.values()]
    .map((entry) => entry.row)
    .sort((left, right) => right.clicks - left.clicks);
}
