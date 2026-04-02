import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  performanceQueryInputShape,
  parsePerformanceQueryInput,
  parseSearchAppearanceQueryInput,
  parseSiteAddInput,
  parseSiteDeleteInput,
  parseSiteSelectorInput,
  parseSitemapDeleteInput,
  parseSitemapGetInput,
  parseSitemapSubmitInput,
  parseUrlInspectionInput,
  searchAppearanceQueryInputShape,
  siteAddInputShape,
  siteDeleteInputShape,
  siteSelectorInputShape,
  sitemapDeleteInputShape,
  sitemapGetInputShape,
  sitemapSubmitInputShape,
  urlInspectionInputShape,
} from "../../domain/inputs.js";
import { assertToolAvailable, isToolAvailable } from "../../domain/tool-policy.js";
import { createAccountCacheScope, createAuthorizedClient } from "../../gsc/auth.js";
import { GoogleSearchConsoleClient } from "../../gsc/client.js";
import type { RuntimeContext, ToolName } from "../../domain/types.js";
import { GscService } from "../../gsc/service.js";
import { resolveAllowedProperty } from "../../utils/site-url.js";
import { errorToolResult, okToolResult } from "../helpers.js";

async function createService(context: RuntimeContext): Promise<GscService> {
  const { oauthClient, tokenRecord } = await createAuthorizedClient(context.env, context.tokenStore, context.logger);
  return new GscService(
    context.config,
    new GoogleSearchConsoleClient(oauthClient, context.logger),
    tokenRecord.scopeMode,
    context.cache,
    createAccountCacheScope(tokenRecord),
    context.cursorSigningSecret,
    context.logger,
    context.audit,
    (selector) => resolveAllowedProperty(context.config, selector),
  );
}

export function registerTools(server: McpServer, context: RuntimeContext): void {
  const registerIfEnabled = (toolName: ToolName, callback: () => void): void => {
    if (isToolAvailable(context.config, toolName)) {
      callback();
    }
  };

  registerIfEnabled("gsc.sites.list", () => server.registerTool(
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
        assertToolAvailable(context.config, "gsc.sites.list");
        const service = await createService(context);
        return okToolResult({ sites: await service.listSites() });
      } catch (error) {
        return errorToolResult(error);
      }
    },
  ));

  registerIfEnabled("gsc.sites.get", () => server.registerTool(
    "gsc.sites.get",
    {
      description: "Get one allowlisted Search Console property by alias or raw allowlisted siteUrl.",
      inputSchema: siteSelectorInputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ site }) => {
      try {
        assertToolAvailable(context.config, "gsc.sites.get");
        const input = parseSiteSelectorInput({ site });
        const service = await createService(context);
        return okToolResult(await service.getSite(input.site) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  ));

  registerIfEnabled("gsc.performance.query", () => server.registerTool(
    "gsc.performance.query",
    {
      description: "Query Search Console performance data with PT date resolution and explicit accuracy metadata.",
      inputSchema: performanceQueryInputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        assertToolAvailable(context.config, "gsc.performance.query");
        const parsedInput = parsePerformanceQueryInput(input);
        const service = await createService(context);
        return okToolResult(await service.queryPerformance(parsedInput) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  ));

  registerIfEnabled("gsc.performance.search_appearance.list", () => server.registerTool(
    "gsc.performance.search_appearance.list",
    {
      description: "List available search appearance buckets using the official first-step Search Console flow.",
      inputSchema: searchAppearanceQueryInputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        assertToolAvailable(context.config, "gsc.performance.search_appearance.list");
        const parsedInput = parseSearchAppearanceQueryInput(input);
        const service = await createService(context);
        return okToolResult(await service.listSearchAppearance(parsedInput) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  ));

  registerIfEnabled("gsc.url.inspect", () => server.registerTool(
    "gsc.url.inspect",
    {
      description: "Inspect one URL using Google's indexed view, not a live fetch.",
      inputSchema: urlInspectionInputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ site, url, forceRefresh }) => {
      try {
        assertToolAvailable(context.config, "gsc.url.inspect");
        const input = parseUrlInspectionInput({ site, url, forceRefresh });
        const service = await createService(context);
        return okToolResult(await service.inspectUrl(input) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  ));

  registerIfEnabled("gsc.sitemaps.list", () => server.registerTool(
    "gsc.sitemaps.list",
    {
      description: "List sitemaps for an allowlisted Search Console property.",
      inputSchema: siteSelectorInputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ site }) => {
      try {
        assertToolAvailable(context.config, "gsc.sitemaps.list");
        const input = parseSiteSelectorInput({ site });
        const service = await createService(context);
        return okToolResult(await service.listSitemaps(input.site) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  ));

  registerIfEnabled("gsc.sitemaps.get", () => server.registerTool(
    "gsc.sitemaps.get",
    {
      description: "Get one sitemap entry for an allowlisted Search Console property.",
      inputSchema: sitemapGetInputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ site, feedpath }) => {
      try {
        assertToolAvailable(context.config, "gsc.sitemaps.get");
        const input = parseSitemapGetInput({ site, feedpath });
        const service = await createService(context);
        return okToolResult(await service.getSitemap(input.site, input.feedpath) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  ));

  registerIfEnabled("gsc.sites.add", () => server.registerTool(
    "gsc.sites.add",
    {
      description: "Add a Search Console property to the linked Google account. This does not verify ownership.",
      inputSchema: siteAddInputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ siteUrl }) => {
      try {
        assertToolAvailable(context.config, "gsc.sites.add");
        const input = parseSiteAddInput({ siteUrl });
        const service = await createService(context);
        return okToolResult(await service.addSite(input) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  ));

  registerIfEnabled("gsc.sites.delete", () => server.registerTool(
    "gsc.sites.delete",
    {
      description: "Delete a Search Console property from the linked Google account. Requires explicit confirmation.",
      inputSchema: siteDeleteInputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ site, confirm }) => {
      try {
        assertToolAvailable(context.config, "gsc.sites.delete");
        const input = parseSiteDeleteInput({ site, confirm });
        const service = await createService(context);
        return okToolResult(await service.deleteSite(input) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  ));

  registerIfEnabled("gsc.sitemaps.submit", () => server.registerTool(
    "gsc.sitemaps.submit",
    {
      description: "Submit a sitemap for an allowlisted Search Console property.",
      inputSchema: sitemapSubmitInputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ site, feedpath }) => {
      try {
        assertToolAvailable(context.config, "gsc.sitemaps.submit");
        const input = parseSitemapSubmitInput({ site, feedpath });
        const service = await createService(context);
        return okToolResult(await service.submitSitemap(input) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  ));

  registerIfEnabled("gsc.sitemaps.delete", () => server.registerTool(
    "gsc.sitemaps.delete",
    {
      description: "Delete a sitemap from an allowlisted Search Console property. Requires explicit confirmation.",
      inputSchema: sitemapDeleteInputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ site, feedpath, confirm }) => {
      try {
        assertToolAvailable(context.config, "gsc.sitemaps.delete");
        const input = parseSitemapDeleteInput({ site, feedpath, confirm });
        const service = await createService(context);
        return okToolResult(await service.deleteSitemap(input) as unknown as Record<string, unknown>);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  ));
}
