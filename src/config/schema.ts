import { z } from "zod";

import { IMPLEMENTED_TOOLS, WRITE_TOOLS } from "../domain/types.js";

const toolNameSchema = z.enum(IMPLEMENTED_TOOLS);
const writeToolNameSchema = z.enum(WRITE_TOOLS);

export const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GSC_MCP_DATA_DIR: z.string().default(".gsc-mcp"),
  GSC_MCP_CACHE_DB: z.string().optional(),
  GSC_MCP_DEBUG: z.string().optional().transform((value) => value === "true"),
  GSC_MCP_FILE_TOKEN_SECRET: z.string().optional(),
});

export const localStateEnvSchema = z.object({
  GSC_MCP_DATA_DIR: z.string().default(".gsc-mcp"),
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
    }),
  ),
  toolPolicy: z.object({
    enabledTools: z.array(toolNameSchema),
    disabledTools: z.array(toolNameSchema),
  }),
  writePolicy: z
    .object({
      enabled: z.boolean().default(false),
      allowedTools: z.array(writeToolNameSchema).default([]),
      requireConfirmationForDestructive: z.boolean().default(true),
      siteAddAllowlist: z.array(z.string().min(1)).default([]),
      siteAddAllowPatterns: z.array(z.string().min(1)).default([]),
      siteDeleteAllowlist: z.array(z.string().min(1)).default([]),
      siteDeleteAllowPatterns: z.array(z.string().min(1)).default([]),
    })
    .default({
      enabled: false,
      allowedTools: [],
      requireConfirmationForDestructive: true,
      siteAddAllowlist: [],
      siteAddAllowPatterns: [],
      siteDeleteAllowlist: [],
      siteDeleteAllowPatterns: [],
    }),
  queryPolicy: z.object({
    defaultDataState: z.enum(["final", "all", "hourly_all"]).default("final"),
    summaryMaxDays: z.number().int().positive(),
    detailMaxDays: z.number().int().positive(),
    detailSplitDailyAfterDays: z.number().int().positive(),
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
