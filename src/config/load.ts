import fs from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import { createDomainError } from "../domain/errors.js";
import type { AppConfig, EnvConfig } from "../domain/types.js";
import { expandHome } from "../utils/paths.js";
import { normalizeSiteUrl, resolvePropertyConfig } from "../utils/site-url.js";
import { validateToolPolicy, validateWritePolicy } from "../domain/tool-policy.js";
import { appConfigSchema, envSchema, localStateEnvSchema } from "./schema.js";

export function loadEnv(env: NodeJS.ProcessEnv, cwd = process.cwd()): EnvConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw createDomainError("CONFIG_ERROR", "Invalid environment configuration.", false, {
      issues: parsed.error.flatten(),
    });
  }

  const dataDir = path.resolve(cwd, expandHome(parsed.data.GSC_MCP_DATA_DIR));
  return {
    googleClientId: parsed.data.GOOGLE_CLIENT_ID,
    googleClientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
    dataDir,
    cacheDbPath: parsed.data.GSC_MCP_CACHE_DB
      ? path.resolve(cwd, expandHome(parsed.data.GSC_MCP_CACHE_DB))
      : undefined,
    debug: parsed.data.GSC_MCP_DEBUG ?? false,
    fileTokenSecret: parsed.data.GSC_MCP_FILE_TOKEN_SECRET,
  };
}

export function loadLocalStateEnv(env: NodeJS.ProcessEnv, cwd = process.cwd()): Pick<EnvConfig, "dataDir" | "debug" | "fileTokenSecret"> {
  const parsed = localStateEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw createDomainError("CONFIG_ERROR", "Invalid local state environment configuration.", false, {
      issues: parsed.error.flatten(),
    });
  }

  return {
    dataDir: path.resolve(cwd, expandHome(parsed.data.GSC_MCP_DATA_DIR)),
    debug: parsed.data.GSC_MCP_DEBUG ?? false,
    fileTokenSecret: parsed.data.GSC_MCP_FILE_TOKEN_SECRET,
  };
}

export async function loadConfig(configPath: string): Promise<AppConfig> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch {
    throw createDomainError("CONFIG_ERROR", `Config file not found: ${configPath}`);
  }

  const parsed = appConfigSchema.safeParse(YAML.parse(raw));
  if (!parsed.success) {
    throw createDomainError("CONFIG_ERROR", "Invalid config file.", false, {
      issues: parsed.error.flatten(),
    });
  }

  const normalizedConfig: AppConfig = {
    ...parsed.data,
    writePolicy: {
      ...parsed.data.writePolicy,
      siteAddAllowlist: parsed.data.writePolicy.siteAddAllowlist.map((siteUrl) => normalizeSiteUrl(siteUrl)),
      siteAddAllowPatterns: parsed.data.writePolicy.siteAddAllowPatterns.map((pattern) => pattern.trim()),
      siteDeleteAllowlist: parsed.data.writePolicy.siteDeleteAllowlist.map((siteUrl) => normalizeSiteUrl(siteUrl)),
      siteDeleteAllowPatterns: parsed.data.writePolicy.siteDeleteAllowPatterns.map((pattern) => pattern.trim()),
    },
  };

  const aliases = new Set<string>();
  const canonicalSites = new Set<string>();
  for (const property of normalizedConfig.properties) {
    if (aliases.has(property.alias)) {
      throw createDomainError("CONFIG_ERROR", `Duplicate property alias: ${property.alias}`);
    }
    aliases.add(property.alias);
    const resolved = resolvePropertyConfig(property);
    if (canonicalSites.has(resolved.canonicalSiteUrl)) {
      throw createDomainError("CONFIG_ERROR", `Duplicate canonical siteUrl is not supported: ${resolved.canonicalSiteUrl}`);
    }
    canonicalSites.add(resolved.canonicalSiteUrl);
  }

  if (normalizedConfig.queryPolicy.detailSplitDailyAfterDays > normalizedConfig.queryPolicy.detailMaxDays) {
    throw createDomainError("CONFIG_ERROR", "detailSplitDailyAfterDays cannot exceed detailMaxDays.");
  }

  validateToolPolicy(normalizedConfig.toolPolicy);
  validateWritePolicy(normalizedConfig);

  return normalizedConfig;
}
