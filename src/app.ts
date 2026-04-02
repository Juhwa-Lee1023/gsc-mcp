import path from "node:path";

import { loadConfig, loadEnv, loadLocalStateEnv } from "./config/load.js";
import type { AuthContext, CacheStore, ConfigContext, EnvConfig, RuntimeContext } from "./domain/types.js";
import { FileAuditSink } from "./security/audit.js";
import { createLogger } from "./security/logger.js";
import { loadOrCreateSecret } from "./security/local-secret.js";
import { createTokenStore } from "./security/token-store.js";
import { ensureDir } from "./utils/fs.js";
import { resolvePropertyConfig } from "./utils/site-url.js";

class NoopCacheStore implements CacheStore {
  async get<T>(): Promise<T | null> {
    return null;
  }

  async set<T>(): Promise<void> {}

  async delete(): Promise<void> {}

  async deletePrefix(): Promise<void> {}

  async clearExpired(): Promise<void> {}

  async close(): Promise<void> {}
}

const defaultAuthLogging = {
  redactPageUrls: true,
  redactQueryStrings: true,
};

type LocalStateEnv = Pick<EnvConfig, "dataDir" | "debug" | "fileTokenSecret">;

async function createLocalStateArtifacts(env: LocalStateEnv, logging = defaultAuthLogging) {
  await ensureDir(env.dataDir);
  return {
    env,
    logger: createLogger(env.debug, logging),
    audit: new FileAuditSink(env.dataDir, logging),
    tokenStore: await createTokenStore({
      dataDir: env.dataDir,
      configuredSecret: env.fileTokenSecret,
    }),
  };
}

async function createAuthArtifacts(env: EnvConfig, logging = defaultAuthLogging): Promise<AuthContext> {
  const artifacts = await createLocalStateArtifacts(env, logging);
  return {
    ...artifacts,
    env,
  };
}

export async function createAuthContext(options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
} = {}): Promise<AuthContext> {
  const cwd = options.cwd ?? process.cwd();
  const env = loadEnv(options.env ?? process.env, cwd);
  return createAuthArtifacts(env);
}

export async function createAuthStateContext(options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
} = {}) {
  const cwd = options.cwd ?? process.cwd();
  const env = loadLocalStateEnv(options.env ?? process.env, cwd);
  return createLocalStateArtifacts(env);
}

export async function createConfigContext(options: {
  cwd?: string;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
} = {}): Promise<ConfigContext> {
  const cwd = options.cwd ?? process.cwd();
  const env = loadEnv(options.env ?? process.env, cwd);
  const configPath = options.configPath
    ? path.resolve(cwd, options.configPath)
    : path.resolve(cwd, "gsc-mcp.config.yaml");
  const config = await loadConfig(configPath);

  return {
    env,
    config,
    properties: config.properties.map(resolvePropertyConfig),
  };
}

export async function createRuntimeContext(options: {
  cwd?: string;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
  skipCache?: boolean;
} = {}): Promise<RuntimeContext> {
  const { env, config, properties } = await createConfigContext(options);
  await ensureDir(env.dataDir);
  const cursorSigningSecret = await loadOrCreateSecret({
    secretPath: path.join(env.dataDir, "security", "cursor-signing.key"),
    configuredSecret: env.fileTokenSecret,
  });
  const authArtifacts = await createAuthArtifacts(env, config.logging);

  return {
    env,
    config,
    properties,
    logger: authArtifacts.logger,
    audit: authArtifacts.audit,
    tokenStore: authArtifacts.tokenStore,
    cursorSigningSecret,
    cache: options.skipCache
      ? new NoopCacheStore()
      : await (async () => {
          const { SqliteCacheStore } = await import("./cache/sqlite-cache.js");
          return SqliteCacheStore.create(env.cacheDbPath ?? path.join(env.dataDir, "cache", "cache.sqlite"));
        })(),
  };
}
