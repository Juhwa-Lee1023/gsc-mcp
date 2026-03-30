import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createAuthorizedClient } from "../../gsc/auth.js";
import { GoogleSearchConsoleClient } from "../../gsc/client.js";
import type { RuntimeContext } from "../../domain/types.js";
import { GscService } from "../../gsc/service.js";
import { resolveAllowedProperty } from "../../utils/site-url.js";
import { errorToolResult, okToolResult } from "../helpers.js";

const performanceInputSchema = {
  site: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  type: z.enum(["web", "image", "video", "news", "discover", "googleNews"]).optional(),
  dimensions: z.array(z.enum(["country", "date", "device", "hour", "page", "query", "searchAppearance"])).optional(),
  filters: z
    .array(
      z.object({
        dimension: z.enum(["country", "date", "device", "hour", "page", "query", "searchAppearance"]),
        operator: z.enum(["contains", "equals", "notContains", "notEquals", "includingRegex", "excludingRegex"]),
        expression: z.string().min(1),
      }),
    )
    .optional(),
  aggregationType: z.enum(["auto", "byPage", "byProperty"]).optional(),
  dataState: z.enum(["final", "all", "hourly_all"]).optional(),
  fidelity: z.enum(["best_effort", "prefer_exact"]).optional(),
  sourcePreference: z.enum(["auto", "live_api", "mirror", "bulk_export"]).optional(),
  pageSize: z.number().int().min(1).max(25_000).optional(),
  cursor: z.string().nullable().optional(),
};

async function createService(context: RuntimeContext): Promise<GscService> {
  const { oauthClient } = await createAuthorizedClient(context.env, context.tokenStore);
  return new GscService(
    context.config,
    new GoogleSearchConsoleClient(oauthClient),
    context.cache,
    `${context.env.googleClientId}:${context.env.dataDir}`,
    context.logger,
    (selector) => resolveAllowedProperty(context.config, selector),
  );
}

export function registerTools(server: McpServer, context: RuntimeContext): void {
  server.registerTool(
    "gsc.sites.list",
    {
      description: "List allowlisted Search Console properties visible to the current Google account.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const service = await createService(context);
        return okToolResult({ sites: await service.listSites() });
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  server.registerTool(
    "gsc.sites.get",
    {
      description: "Get one allowlisted Search Console property by alias or raw allowlisted siteUrl.",
      inputSchema: { site: z.string().min(1) },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ site }) => {
      try {
        const service = await createService(context);
        return okToolResult(await service.getSite(site) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  server.registerTool(
    "gsc.performance.query",
    {
      description: "Query Search Console performance data with PT date resolution and explicit accuracy metadata.",
      inputSchema: performanceInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const service = await createService(context);
        return okToolResult(await service.queryPerformance(input) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  server.registerTool(
    "gsc.performance.search_appearance.list",
    {
      description: "List available search appearance buckets using the official first-step Search Console flow.",
      inputSchema: {
        site: z.string().min(1),
        startDate: z.string().min(1),
        endDate: z.string().min(1),
        type: z.enum(["web", "image", "video", "news", "discover", "googleNews"]).optional(),
        dataState: z.enum(["final", "all", "hourly_all"]).optional(),
        pageSize: z.number().int().min(1).max(25_000).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const service = await createService(context);
        return okToolResult(await service.listSearchAppearance(input) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  server.registerTool(
    "gsc.url.inspect",
    {
      description: "Inspect one URL using Google's indexed view, not a live fetch.",
      inputSchema: {
        site: z.string().min(1),
        url: z.string().url(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ site, url }) => {
      try {
        const service = await createService(context);
        return okToolResult(await service.inspectUrl(site, url) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  server.registerTool(
    "gsc.sitemaps.list",
    {
      description: "List sitemaps for an allowlisted Search Console property.",
      inputSchema: { site: z.string().min(1) },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ site }) => {
      try {
        const service = await createService(context);
        return okToolResult(await service.listSitemaps(site) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  server.registerTool(
    "gsc.sitemaps.get",
    {
      description: "Get one sitemap entry for an allowlisted Search Console property.",
      inputSchema: {
        site: z.string().min(1),
        feedpath: z.string().min(1),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ site, feedpath }) => {
      try {
        const service = await createService(context);
        return okToolResult(await service.getSitemap(site, feedpath) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );
}
