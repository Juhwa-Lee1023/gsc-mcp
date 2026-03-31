import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { Command, Option } from "commander";

import { createAuthContext, createConfigContext, createRuntimeContext } from "../app.js";
import {
  parsePerformanceQueryInput,
  parseSearchAppearanceQueryInput,
  parseSitemapGetInput,
  parseSiteSelectorInput,
  parseUrlInspectionInput,
} from "../domain/inputs.js";
import { createDomainError, toDomainError } from "../domain/errors.js";
import type { RuntimeContext } from "../domain/types.js";
import { assertToolEnabled } from "../domain/tool-policy.js";
import { createAccountCacheScope, createAuthorizedClient, createOAuthClient, loginWithLoopback } from "../gsc/auth.js";
import { GoogleSearchConsoleClient } from "../gsc/client.js";
import { GscService } from "../gsc/service.js";
import { serveStdio } from "../mcp/server.js";
import { loadConfig, loadEnv } from "../config/load.js";
import { createTokenStore } from "../security/token-store.js";
import { safeWriteAuditEvent } from "../security/audit-utils.js";
import { copyIfMissing, fileExists } from "../utils/fs.js";
import { jsonText } from "../utils/json.js";
import { findPackageRoot } from "../utils/paths.js";
import { resolvePropertyConfig, resolveAllowedProperty } from "../utils/site-url.js";

dotenv.config({ quiet: true });

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

async function createServiceForTool(context: RuntimeContext, toolName: import("../domain/types.js").ToolName): Promise<GscService> {
  assertToolEnabled(context.config.toolPolicy, toolName);
  return createService(context);
}

async function assertCliToolEnabled(toolName: import("../domain/types.js").ToolName): Promise<void> {
  const context = await createConfigContext();
  assertToolEnabled(context.config.toolPolicy, toolName);
}

function parseJsonOption(value: string | undefined, label: string): unknown {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    throw createDomainError("INVALID_ARGUMENT", `${label} must be valid JSON.`);
  }
}

async function runAuthFlow(options: {
  action: "auth.login" | "auth.upgrade";
  requestedScope: "readonly" | "write";
}): Promise<void> {
  const context = await createAuthContext();
  const startedAt = Date.now();

  try {
    const token = await loginWithLoopback(context.env, context.tokenStore, options.requestedScope, {
      onManualAuthorizationUrl(authUrl, details) {
        process.stderr.write(
          `Browser auto-open failed (${details.browserError}). Open this URL manually to continue:\n${authUrl}\n`,
        );
      },
    });
    const details = {
      requestedScope: options.requestedScope,
      scopeMode: token.scopeMode,
      tokenStore: context.tokenStore.kind,
      latencyMs: Date.now() - startedAt,
    };
    context.logger.info("Auth flow completed", {
      action: options.action,
      ...details,
    });
    await safeWriteAuditEvent(context.audit, context.logger, {
      timestamp: new Date().toISOString(),
      action: options.action,
      outcome: "success",
      details,
    });
    process.stdout.write(`${jsonText({ tokenStore: context.tokenStore.kind, scopeMode: token.scopeMode, updatedAt: token.updatedAt })}\n`);
  } catch (error) {
    const domainError = toDomainError(error);
    const details = {
      requestedScope: options.requestedScope,
      tokenStore: context.tokenStore.kind,
      latencyMs: Date.now() - startedAt,
      errorCode: domainError.code,
      retryable: domainError.retryable,
    };
    context.logger.warn("Auth flow failed", {
      action: options.action,
      ...details,
    });
    await safeWriteAuditEvent(context.audit, context.logger, {
      timestamp: new Date().toISOString(),
      action: options.action,
      outcome: "failure",
      details,
    });
    throw error;
  }
}

async function runAuthLogout(): Promise<void> {
  const context = await createAuthContext();
  const startedAt = Date.now();

  try {
    const hadToken = Boolean(await context.tokenStore.get());
    await context.tokenStore.delete();
    const details = {
      tokenStore: context.tokenStore.kind,
      hadToken,
      latencyMs: Date.now() - startedAt,
    };
    context.logger.info("Auth logout completed", details);
    await safeWriteAuditEvent(context.audit, context.logger, {
      timestamp: new Date().toISOString(),
      action: "auth.logout",
      outcome: "success",
      details,
    });
    process.stdout.write(`${jsonText({ tokenStore: context.tokenStore.kind, linked: false, removed: hadToken })}\n`);
  } catch (error) {
    const domainError = toDomainError(error);
    const details = {
      tokenStore: context.tokenStore.kind,
      latencyMs: Date.now() - startedAt,
      errorCode: domainError.code,
      retryable: domainError.retryable,
    };
    context.logger.warn("Auth logout failed", details);
    await safeWriteAuditEvent(context.audit, context.logger, {
      timestamp: new Date().toISOString(),
      action: "auth.logout",
      outcome: "failure",
      details,
    });
    throw error;
  }
}

async function buildDoctorDiagnostics(cwd: string): Promise<Record<string, unknown>> {
  const envFilePresent = await fileExists(path.join(cwd, ".env"));
  const configFilePresent = await fileExists(path.join(cwd, "gsc-mcp.config.yaml"));

  let envError: unknown = null;
  let configError: unknown = null;
  let tokenStoreKind: string | null = null;
  let linked: boolean | null = null;
  let dataDir: string | null = null;
  let cacheDbPath: string | null = null;
  let propertyCount: number | null = null;
  let readOnlyDefault: boolean | null = null;

  try {
    const env = loadEnv(process.env, cwd);
    dataDir = env.dataDir;
    cacheDbPath = env.cacheDbPath ?? path.join(env.dataDir, "cache", "cache.sqlite");
    const tokenStore = await createTokenStore({
      dataDir: env.dataDir,
      configuredSecret: env.fileTokenSecret,
    });
    tokenStoreKind = tokenStore.kind;
    linked = Boolean(await tokenStore.get());
    createOAuthClient(env, "http://127.0.0.1");
  } catch (error) {
    envError = toDomainError(error).toJSON();
  }

  try {
    const config = await loadConfig(path.join(cwd, "gsc-mcp.config.yaml"));
    propertyCount = config.properties.map(resolvePropertyConfig).length;
    readOnlyDefault = config.google.defaultScope === "readonly";
  } catch (error) {
    configError = toDomainError(error).toJSON();
  }

  return {
    nodeVersion: process.version,
    cwd,
    envFilePresent,
    configFilePresent,
    envValid: envError === null,
    configValid: configError === null,
    envError,
    configError,
    tokenStore: tokenStoreKind,
    linked,
    dataDir,
    cacheDbPath,
    propertyCount,
    readOnlyDefault,
  };
}

const program = new Command();
program
  .name("gsc-mcp")
  .description("A narrow, reliable Google Search Console MCP server and CLI.")
  .version("0.1.0");

program
  .command("init")
  .description("Create starter .env and gsc-mcp.config.yaml files if missing.")
  .action(async () => {
    const cwd = process.cwd();
    const packageRoot = await findPackageRoot(path.dirname(fileURLToPath(import.meta.url)));
    const envCreated = await copyIfMissing(path.join(packageRoot, ".env.example"), path.join(cwd, ".env"), {
      mode: 0o600,
    });
    const configCreated = await copyIfMissing(
      path.join(packageRoot, "gsc-mcp.config.example.yaml"),
      path.join(cwd, "gsc-mcp.config.yaml"),
    );
    process.stdout.write(`${jsonText({ envCreated, configCreated })}\n`);
  });

const auth = program.command("auth").description("Manage Google OAuth credentials.");
auth
  .command("login")
  .addOption(new Option("--scope <scope>", "Scope to request").choices(["readonly", "write"]).default("readonly"))
  .action(async (options: { scope: "readonly" | "write" }) => {
    await runAuthFlow({
      action: "auth.login",
      requestedScope: options.scope,
    });
  });

auth
  .command("upgrade")
  .addOption(new Option("--scope <scope>", "Scope to request").choices(["readonly", "write"]).default("write"))
  .action(async (options: { scope: "readonly" | "write" }) => {
    await runAuthFlow({
      action: "auth.upgrade",
      requestedScope: options.scope,
    });
  });

auth
  .command("status")
  .action(async () => {
    const context = await createAuthContext();
    const token = await context.tokenStore.get();
    process.stdout.write(
      `${jsonText({
        tokenStore: context.tokenStore.kind,
        linked: Boolean(token),
        scopeMode: token?.scopeMode ?? null,
        updatedAt: token?.updatedAt ?? null,
      })}\n`,
    );
  });

auth
  .command("logout")
  .description("Delete the locally stored Google OAuth token.")
  .action(async () => {
    await runAuthLogout();
  });

const configCmd = program.command("config").description("Inspect config.");
configCmd
  .command("show")
  .action(async () => {
    const context = await createRuntimeContext({ skipCache: true });
    process.stdout.write(
      `${jsonText({
        google: context.config.google,
        properties: context.properties,
        toolPolicy: context.config.toolPolicy,
        queryPolicy: context.config.queryPolicy,
        cache: context.config.cache,
        logging: context.config.logging,
        resolved: {
          dataDir: context.env.dataDir,
          cacheDbPath: context.env.cacheDbPath ?? path.join(context.env.dataDir, "cache", "cache.sqlite"),
          debug: context.env.debug,
        },
      })}\n`,
    );
  });

program
  .command("doctor")
  .description("Run local diagnostics.")
  .action(async () => {
    const cwd = process.cwd();
    process.stdout.write(`${jsonText(await buildDoctorDiagnostics(cwd))}\n`);
  });

const sites = program.command("sites").description("Site commands.");
sites.command("list").action(async () => {
  await assertCliToolEnabled("gsc.sites.list");
  const context = await createRuntimeContext();
  const service = await createServiceForTool(context, "gsc.sites.list");
  process.stdout.write(`${jsonText({ sites: await service.listSites() })}\n`);
});

const performance = program.command("performance").description("Performance commands.");
performance
  .command("query")
  .requiredOption("--site <site>")
  .requiredOption("--start-date <date>")
  .requiredOption("--end-date <date>")
  .option("--type <type>")
  .option("--dimensions <dimensions>", "Comma-separated dimensions")
  .option("--filters-json <json>", "JSON array of filter objects")
  .option("--aggregation-type <type>")
  .option("--data-state <state>")
  .option("--fidelity <mode>")
  .option("--source-preference <source>")
  .option("--page-size <pageSize>")
  .option("--cursor <cursor>")
  .action(async (options) => {
    const input = parsePerformanceQueryInput({
      site: options.site,
      startDate: options.startDate,
      endDate: options.endDate,
      type: options.type,
      dimensions: options.dimensions ? options.dimensions.split(",").map((value: string) => value.trim()) : undefined,
      filters: parseJsonOption(options.filtersJson, "filters-json"),
      aggregationType: options.aggregationType,
      dataState: options.dataState,
      fidelity: options.fidelity,
      sourcePreference: options.sourcePreference,
      pageSize: options.pageSize ? Number(options.pageSize) : undefined,
      cursor: options.cursor ?? null,
    });
    await assertCliToolEnabled("gsc.performance.query");
    const context = await createRuntimeContext();
    const service = await createServiceForTool(context, "gsc.performance.query");
    process.stdout.write(
      `${jsonText(await service.queryPerformance(input))}\n`,
    );
  });

performance
  .command("search-appearance")
  .requiredOption("--site <site>")
  .requiredOption("--start-date <date>")
  .requiredOption("--end-date <date>")
  .option("--type <type>")
  .option("--data-state <state>")
  .option("--page-size <pageSize>")
  .option("--fidelity <mode>")
  .option("--source-preference <source>")
  .action(async (options) => {
    const input = parseSearchAppearanceQueryInput({
      site: options.site,
      startDate: options.startDate,
      endDate: options.endDate,
      type: options.type,
      dataState: options.dataState,
      pageSize: options.pageSize ? Number(options.pageSize) : undefined,
      fidelity: options.fidelity,
      sourcePreference: options.sourcePreference,
    });
    await assertCliToolEnabled("gsc.performance.search_appearance.list");
    const context = await createRuntimeContext();
    const service = await createServiceForTool(context, "gsc.performance.search_appearance.list");
    process.stdout.write(
      `${jsonText(await service.listSearchAppearance(input))}\n`,
    );
  });

const sitemaps = program.command("sitemaps").description("Sitemap commands.");
sitemaps
  .command("list")
  .requiredOption("--site <site>")
  .action(async (options) => {
    const input = parseSiteSelectorInput({ site: options.site });
    await assertCliToolEnabled("gsc.sitemaps.list");
    const context = await createRuntimeContext();
    const service = await createServiceForTool(context, "gsc.sitemaps.list");
    process.stdout.write(`${jsonText(await service.listSitemaps(input.site))}\n`);
  });

sitemaps
  .command("get")
  .requiredOption("--site <site>")
  .requiredOption("--feedpath <feedpath>")
  .action(async (options) => {
    const input = parseSitemapGetInput({ site: options.site, feedpath: options.feedpath });
    await assertCliToolEnabled("gsc.sitemaps.get");
    const context = await createRuntimeContext();
    const service = await createServiceForTool(context, "gsc.sitemaps.get");
    process.stdout.write(`${jsonText(await service.getSitemap(input.site, input.feedpath))}\n`);
  });

const url = program.command("url").description("URL commands.");
url
  .command("inspect")
  .requiredOption("--site <site>")
  .requiredOption("--url <url>")
  .option("--force-refresh", "Bypass the local inspection cache")
  .action(async (options) => {
    const input = parseUrlInspectionInput({ site: options.site, url: options.url, forceRefresh: Boolean(options.forceRefresh) });
    await assertCliToolEnabled("gsc.url.inspect");
    const context = await createRuntimeContext();
    const service = await createServiceForTool(context, "gsc.url.inspect");
    process.stdout.write(`${jsonText(await service.inspectUrl(input))}\n`);
  });

const serve = program.command("serve").description("Serve the MCP server.");
serve.command("stdio").action(async () => {
  const context = await createRuntimeContext();
  context.logger.info("Starting stdio server", { transport: "stdio" });
  await serveStdio(context);
});

program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(`${jsonText(toDomainError(error).toJSON())}\n`);
  process.exitCode = 1;
});
