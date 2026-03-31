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
  SplitStrategy,
} from "./types.js";
import { decodeCursor, encodeCursor } from "../utils/cursor.js";
import { stableHash } from "../utils/crypto.js";
import { diffDaysInclusive, enumeratePtDates, normalizePtDate } from "../utils/time.js";

export const DEFAULT_PAGE_SIZE = 1000;
export const MAX_PAGE_SIZE = 25_000;
const MAX_SUMMARY_CHUNKS = 12;

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

function chunkDateRanges(startDate: string, endDate: string, chunkSizeDays: number): Array<{ startDate: string; endDate: string }> {
  const dates = enumeratePtDates(startDate, endDate);
  const ranges: Array<{ startDate: string; endDate: string }> = [];
  for (let index = 0; index < dates.length; index += chunkSizeDays) {
    const chunk = dates.slice(index, index + chunkSizeDays);
    ranges.push({
      startDate: chunk[0]!,
      endDate: chunk[chunk.length - 1]!,
    });
  }
  return ranges;
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

  if (detail && normalizedIntent.fidelity === "prefer_exact") {
    throw createDomainError(
      "NOT_IMPLEMENTED",
      "fidelity=prefer_exact is not supported for page/query detail queries in live API mode.",
    );
  }

  if (detail && dayCount > config.queryPolicy.detailMaxDays) {
    throw createDomainError(
      "HIGH_CARDINALITY_RANGE_UNSAFE",
      `Requested detail range exceeds safe live API limits (${config.queryPolicy.detailMaxDays} days).`,
    );
  }

  if (!detail && dayCount > config.queryPolicy.summaryMaxDays) {
    const summaryChunkCount = Math.ceil(dayCount / config.queryPolicy.summaryMaxDays);
    if (summaryChunkCount > MAX_SUMMARY_CHUNKS) {
      throw createDomainError(
        "HIGH_CARDINALITY_RANGE_UNSAFE",
        `Requested summary range exceeds the live API chunk safety limit (${MAX_SUMMARY_CHUNKS} chunks). Narrow the date range.`,
      );
    }
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

  const splitStrategy: SplitStrategy = detail
    ? dayCount > config.queryPolicy.detailSplitDailyAfterDays
      ? "detail_daily"
      : "none"
    : dayCount > config.queryPolicy.summaryMaxDays
      ? "summary_chunked"
      : "none";
  const splitApplied = splitStrategy !== "none";
  const dateRanges =
    splitStrategy === "detail_daily"
      ? enumeratePtDates(normalizedIntent.startDate, normalizedIntent.endDate).map((date) => ({
          startDate: date,
          endDate: date,
        }))
      : splitStrategy === "summary_chunked"
        ? chunkDateRanges(normalizedIntent.startDate, normalizedIntent.endDate, config.queryPolicy.summaryMaxDays)
        : [
            {
              startDate: normalizedIntent.startDate,
              endDate: normalizedIntent.endDate,
            },
          ];

  return {
    property,
    normalizedIntent,
    requestHash,
    resolvedStartDatePT: normalizedIntent.startDate,
    resolvedEndDatePT: normalizedIntent.endDate,
    startRow,
    pageSize: normalizedIntent.pageSize,
    splitApplied,
    splitStrategy,
    dateRanges,
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
    splitStrategy: args.plan.splitStrategy,
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
