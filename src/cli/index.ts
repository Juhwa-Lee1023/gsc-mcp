import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { Command } from "commander";

import { createRuntimeContext } from "../app.js";
import { toDomainError } from "../domain/errors.js";
import type { RuntimeContext } from "../domain/types.js";
import { loginWithLoopback, createAuthorizedClient } from "../gsc/auth.js";
import { GoogleSearchConsoleClient } from "../gsc/client.js";
import { GscService } from "../gsc/service.js";
import { serveStdio } from "../mcp/server.js";
import { copyIfMissing, fileExists } from "../utils/fs.js";
import { jsonText } from "../utils/json.js";
import { findPackageRoot } from "../utils/paths.js";
import { resolveAllowedProperty } from "../utils/site-url.js";

dotenv.config({ quiet: true });

async function createService(context: RuntimeContext): Promise<GscService> {
  const { oauthClient } = await createAuthorizedClient(context.env, context.tokenStore);
  return new GscService(
    context.config,
    new GoogleSearchConsoleClient(oauthClient),
    context.cache,
    context.cursorSigningSecret,
    context.logger,
    (selector) => resolveAllowedProperty(context.config, selector),
  );
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
  .option("--scope <scope>", "Scope to request", "readonly")
  .action(async (options: { scope: "readonly" | "write" }) => {
    const context = await createRuntimeContext({ skipCache: true });
    const token = await loginWithLoopback(context.env, context.tokenStore, options.scope);
    process.stdout.write(`${jsonText({ tokenStore: context.tokenStore.kind, scopeMode: token.scopeMode, updatedAt: token.updatedAt })}\n`);
  });

auth
  .command("upgrade")
  .option("--scope <scope>", "Scope to request", "write")
  .action(async (options: { scope: "readonly" | "write" }) => {
    const context = await createRuntimeContext({ skipCache: true });
    const token = await loginWithLoopback(context.env, context.tokenStore, options.scope);
    process.stdout.write(`${jsonText({ tokenStore: context.tokenStore.kind, scopeMode: token.scopeMode, updatedAt: token.updatedAt })}\n`);
  });

auth
  .command("status")
  .action(async () => {
    const context = await createRuntimeContext({ skipCache: true });
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
    const context = await createRuntimeContext({ skipCache: true });
    const token = await context.tokenStore.get();
    process.stdout.write(
      `${jsonText({
        nodeVersion: process.version,
        cwd,
        envFilePresent: await fileExists(path.join(cwd, ".env")),
        configFilePresent: await fileExists(path.join(cwd, "gsc-mcp.config.yaml")),
        tokenStore: context.tokenStore.kind,
        linked: Boolean(token),
        dataDir: context.env.dataDir,
        cacheDbPath: context.env.cacheDbPath ?? path.join(context.env.dataDir, "cache", "cache.sqlite"),
        propertyCount: context.properties.length,
        readOnlyDefault: context.config.google.defaultScope === "readonly",
      })}\n`,
    );
  });

const sites = program.command("sites").description("Site commands.");
sites.command("list").action(async () => {
  const context = await createRuntimeContext();
  const service = await createService(context);
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
    const context = await createRuntimeContext();
    const service = await createService(context);
    process.stdout.write(
      `${jsonText(
        await service.queryPerformance({
          site: options.site,
          startDate: options.startDate,
          endDate: options.endDate,
          type: options.type,
          dimensions: options.dimensions ? options.dimensions.split(",").map((value: string) => value.trim()) : undefined,
          filters: options.filtersJson ? JSON.parse(options.filtersJson) : undefined,
          aggregationType: options.aggregationType,
          dataState: options.dataState,
          fidelity: options.fidelity,
          sourcePreference: options.sourcePreference,
          pageSize: options.pageSize ? Number(options.pageSize) : undefined,
          cursor: options.cursor ?? null,
        }),
      )}\n`,
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
  .action(async (options) => {
    const context = await createRuntimeContext();
    const service = await createService(context);
    process.stdout.write(
      `${jsonText(
        await service.listSearchAppearance({
          site: options.site,
          startDate: options.startDate,
          endDate: options.endDate,
          type: options.type,
          dataState: options.dataState,
          pageSize: options.pageSize ? Number(options.pageSize) : undefined,
        }),
      )}\n`,
    );
  });

const sitemaps = program.command("sitemaps").description("Sitemap commands.");
sitemaps
  .command("list")
  .requiredOption("--site <site>")
  .action(async (options) => {
    const context = await createRuntimeContext();
    const service = await createService(context);
    process.stdout.write(`${jsonText(await service.listSitemaps(options.site))}\n`);
  });

sitemaps
  .command("get")
  .requiredOption("--site <site>")
  .requiredOption("--feedpath <feedpath>")
  .action(async (options) => {
    const context = await createRuntimeContext();
    const service = await createService(context);
    process.stdout.write(`${jsonText(await service.getSitemap(options.site, options.feedpath))}\n`);
  });

const url = program.command("url").description("URL commands.");
url
  .command("inspect")
  .requiredOption("--site <site>")
  .requiredOption("--url <url>")
  .action(async (options) => {
    const context = await createRuntimeContext();
    const service = await createService(context);
    process.stdout.write(`${jsonText(await service.inspectUrl(options.site, options.url))}\n`);
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
