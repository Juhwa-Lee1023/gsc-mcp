import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { toDomainError } from "../../domain/errors.js";
import { listAvailablePromptNames, listAvailableResourceUris } from "../../domain/surface.js";
import { assertToolEnabled, isToolEnabled, listEffectiveEnabledTools } from "../../domain/tool-policy.js";
import type { RuntimeContext } from "../../domain/types.js";
import { createAccountCacheScope, createAuthorizedClient } from "../../gsc/auth.js";
import { GoogleSearchConsoleClient } from "../../gsc/client.js";
import { GscService } from "../../gsc/service.js";
import { resolveAllowedProperty } from "../../utils/site-url.js";
import { jsonResource } from "../helpers.js";

async function createService(context: RuntimeContext): Promise<GscService> {
  const { oauthClient, tokenRecord } = await createAuthorizedClient(context.env, context.tokenStore, context.logger);
  return new GscService(
    context.config,
    new GoogleSearchConsoleClient(oauthClient, context.logger),
    context.cache,
    createAccountCacheScope(tokenRecord),
    context.cursorSigningSecret,
    context.logger,
    context.audit,
    (selector) => resolveAllowedProperty(context.config, selector),
  );
}

export function registerResources(server: McpServer, context: RuntimeContext): void {
  server.registerResource(
    "gsc://capabilities",
    "gsc://capabilities",
    {
      title: "gsc-mcp capabilities",
      description: "Static capability matrix for the current gsc-mcp server.",
      mimeType: "application/json",
    },
    async (uri) =>
      jsonResource(uri.toString(), {
        transport: "stdio",
        defaultScope: context.config.google.defaultScope,
        readOnlyByDefault: true,
        tools: listEffectiveEnabledTools(context.config.toolPolicy),
        resources: listAvailableResourceUris(context.config.toolPolicy),
        prompts: listAvailablePromptNames(context.config.toolPolicy),
      }),
  );

  server.registerResource(
    "gsc://policies/current",
    "gsc://policies/current",
    {
      title: "Current policies",
      description: "Sanitized current property, tool, and query policies.",
      mimeType: "application/json",
    },
    async (uri) =>
      jsonResource(uri.toString(), {
        google: context.config.google,
        properties: context.properties.map((property) => ({
          alias: property.alias,
          siteUrl: property.canonicalSiteUrl,
          allowRead: property.allowRead,
        })),
        toolPolicy: context.config.toolPolicy,
        queryPolicy: context.config.queryPolicy,
      }),
  );

  if (isToolEnabled(context.config.toolPolicy, "gsc.sites.list")) {
    server.registerResource(
      "gsc://sites",
      "gsc://sites",
      {
        title: "Allowlisted sites",
        description: "Allowlisted Search Console sites joined with Google visibility when auth is available.",
        mimeType: "application/json",
      },
      async (uri) => {
        try {
          assertToolEnabled(context.config.toolPolicy, "gsc.sites.list");
          const service = await createService(context);
          return jsonResource(uri.toString(), { sites: await service.listSites() });
        } catch (error) {
          return jsonResource(uri.toString(), {
            sites: [],
            error: toDomainError(error).toJSON(),
          });
        }
      },
    );
  }

  if (isToolEnabled(context.config.toolPolicy, "gsc.sitemaps.list")) {
    server.registerResource(
      "gsc://site/{site}/sitemaps",
      new ResourceTemplate("gsc://site/{site}/sitemaps", {
        list: undefined,
        complete: {
          site: async () => context.properties.map((property) => property.alias),
        },
      }),
      {
        title: "Property sitemaps",
        description: "Sitemaps for one allowlisted Search Console property.",
        mimeType: "application/json",
      },
      async (uri, variables) => {
        try {
          assertToolEnabled(context.config.toolPolicy, "gsc.sitemaps.list");
          const service = await createService(context);
          return jsonResource(uri.toString(), await service.listSitemaps(String(variables.site)));
        } catch (error) {
          return jsonResource(uri.toString(), {
            error: toDomainError(error).toJSON(),
          });
        }
      },
    );
  }
}
