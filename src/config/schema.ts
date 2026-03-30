import { z } from "zod";

const toolNameSchema = z.enum([
  "gsc.sites.list",
  "gsc.sites.get",
  "gsc.performance.query",
  "gsc.performance.search_appearance.list",
  "gsc.url.inspect",
  "gsc.sitemaps.list",
  "gsc.sitemaps.get",
  "gsc.sites.add",
  "gsc.sites.delete",
  "gsc.sitemaps.submit",
  "gsc.sitemaps.delete",
]);

export const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GSC_MCP_DATA_DIR: z.string().default(".gsc-mcp"),
  GSC_MCP_CACHE_DB: z.string().optional(),
  GSC_MCP_DEBUG: z.string().optional().transform((value) => value === "true"),
  GSC_MCP_FILE_TOKEN_SECRET: z.string().optional(),
});

export const appConfigSchema = z.object({
  google: z.object({
    defaultScope: z.enum(["readonly", "write"]).default("readonly"),
  }),
  properties: z.array(
    z.object({
      alias: z.string().min(1),
      siteUrl: z.string().min(1),
      allowRead: z.boolean(),
      allowWrite: z.boolean(),
    }),
  ),
  toolPolicy: z.object({
    enabledTools: z.array(toolNameSchema),
    disabledTools: z.array(toolNameSchema),
  }),
  queryPolicy: z.object({
    defaultDataState: z.enum(["final", "all", "hourly_all"]).default("final"),
    summaryMaxDays: z.number().int().positive(),
    detailMaxDays: z.number().int().positive(),
    detailSplitDailyAfterDays: z.number().int().positive(),
    blockExactWithPageOrQueryWithoutBulkExport: z.boolean(),
  }),
  cache: z.object({
    enabled: z.boolean().default(true),
    sitesTtlSeconds: z.number().int().nonnegative(),
    sitemapsTtlSeconds: z.number().int().nonnegative(),
    urlInspectionTtlSeconds: z.number().int().nonnegative(),
    finalizedPerformanceTtlSeconds: z.number().int().nonnegative(),
    freshPerformanceTtlSeconds: z.number().int().nonnegative(),
  }),
  logging: z.object({
    redactPageUrls: z.boolean().default(true),
    redactQueryStrings: z.boolean().default(true),
    auditLogPath: z.string().optional(),
  }),
});
