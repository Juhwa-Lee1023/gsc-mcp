import { z } from "zod";

import { createDomainError } from "./errors.js";
import {
  AGGREGATION_TYPES,
  DATA_STATES,
  FIDELITY_MODES,
  PERFORMANCE_DIMENSIONS,
  SEARCH_TYPES,
  SOURCE_PREFERENCES,
} from "./types.js";

function parseWithDomainError<T>(schema: z.ZodType<T>, input: unknown, message: string): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw createDomainError("INVALID_ARGUMENT", message, false, {
      issues: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

export const performanceFilterShape = {
  dimension: z.enum(PERFORMANCE_DIMENSIONS),
  operator: z.enum(["contains", "equals", "notContains", "notEquals", "includingRegex", "excludingRegex"]),
  expression: z.string().min(1),
} as const;

export const performanceQueryInputShape = {
  site: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  type: z.enum(SEARCH_TYPES).optional(),
  dimensions: z.array(z.enum(PERFORMANCE_DIMENSIONS)).optional(),
  filters: z.array(z.object(performanceFilterShape)).optional(),
  aggregationType: z.enum(AGGREGATION_TYPES).optional(),
  dataState: z.enum(DATA_STATES).optional(),
  fidelity: z.enum(FIDELITY_MODES).optional(),
  sourcePreference: z.enum(SOURCE_PREFERENCES).optional(),
  pageSize: z.number().int().min(1).max(25_000).optional(),
  cursor: z.string().min(1).nullable().optional(),
  searchType: z.unknown().optional(),
} as const;

export const performanceQueryInputSchema = z.object(performanceQueryInputShape).strict();

export const searchAppearanceQueryInputShape = {
  site: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  type: z.enum(SEARCH_TYPES).optional(),
  dataState: z.enum(DATA_STATES).optional(),
  pageSize: z.number().int().min(1).max(25_000).optional(),
  fidelity: z.enum(FIDELITY_MODES).optional(),
  sourcePreference: z.enum(SOURCE_PREFERENCES).optional(),
} as const;

export const searchAppearanceQueryInputSchema = z.object(searchAppearanceQueryInputShape).strict();

export const siteSelectorInputShape = {
  site: z.string().min(1),
} as const;

export const siteSelectorInputSchema = z.object(siteSelectorInputShape).strict();

export const sitemapGetInputShape = {
  site: z.string().min(1),
  feedpath: z.string().min(1),
} as const;

export const sitemapGetInputSchema = z.object(sitemapGetInputShape).strict();

export const siteAddInputShape = {
  siteUrl: z.string().min(1),
} as const;

export const siteAddInputSchema = z.object(siteAddInputShape).strict();

export const siteDeleteInputShape = {
  site: z.string().min(1),
  confirm: z.boolean().optional().default(false),
} as const;

export const siteDeleteInputSchema = z.object(siteDeleteInputShape).strict();

export const sitemapSubmitInputShape = {
  site: z.string().min(1),
  feedpath: z.string().min(1),
} as const;

export const sitemapSubmitInputSchema = z.object(sitemapSubmitInputShape).strict();

export const sitemapDeleteInputShape = {
  site: z.string().min(1),
  feedpath: z.string().min(1),
  confirm: z.boolean().optional().default(false),
} as const;

export const sitemapDeleteInputSchema = z.object(sitemapDeleteInputShape).strict();

export const urlInspectionInputShape = {
  site: z.string().min(1),
  url: z.string().url(),
  forceRefresh: z.boolean().optional().default(false),
} as const;

export const urlInspectionInputSchema = z.object(urlInspectionInputShape).strict();

export function parsePerformanceQueryInput(input: unknown) {
  return parseWithDomainError(performanceQueryInputSchema, input, "Invalid performance query input.");
}

export function parseSearchAppearanceQueryInput(input: unknown) {
  return parseWithDomainError(searchAppearanceQueryInputSchema, input, "Invalid search appearance query input.");
}

export function parseSiteSelectorInput(input: unknown) {
  return parseWithDomainError(siteSelectorInputSchema, input, "Invalid site selector input.");
}

export function parseSitemapGetInput(input: unknown) {
  return parseWithDomainError(sitemapGetInputSchema, input, "Invalid sitemap lookup input.");
}

export function parseSiteAddInput(input: unknown) {
  return parseWithDomainError(siteAddInputSchema, input, "Invalid site add input.");
}

export function parseSiteDeleteInput(input: unknown) {
  return parseWithDomainError(siteDeleteInputSchema, input, "Invalid site delete input.");
}

export function parseSitemapSubmitInput(input: unknown) {
  return parseWithDomainError(sitemapSubmitInputSchema, input, "Invalid sitemap submit input.");
}

export function parseSitemapDeleteInput(input: unknown) {
  return parseWithDomainError(sitemapDeleteInputSchema, input, "Invalid sitemap delete input.");
}

export function parseUrlInspectionInput(input: unknown) {
  return parseWithDomainError(urlInspectionInputSchema, input, "Invalid URL inspection input.");
}
