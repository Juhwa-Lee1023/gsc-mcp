import path from "node:path";

import { loadConfig, loadEnv } from "./config/load.js";
import type { CacheStore, RuntimeContext } from "./domain/types.js";
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

  async clearExpired(): Promise<void> {}

  async close(): Promise<void> {}
}

export async function createRuntimeContext(options: {
  cwd?: string;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
  skipCache?: boolean;
} = {}): Promise<RuntimeContext> {
  const cwd = options.cwd ?? process.cwd();
  const env = loadEnv(options.env ?? process.env, cwd);
  const configPath = options.configPath
    ? path.resolve(cwd, options.configPath)
    : path.resolve(cwd, "gsc-mcp.config.yaml");
  const config = await loadConfig(configPath);
  await ensureDir(env.dataDir);
  const cursorSigningSecret = await loadOrCreateSecret({
    secretPath: path.join(env.dataDir, "security", "cursor-signing.key"),
    configuredSecret: env.fileTokenSecret,
  });

  return {
    env,
    config,
    properties: config.properties.map(resolvePropertyConfig),
    logger: createLogger(env.debug, config.logging),
    audit: new FileAuditSink(env.dataDir, config.logging),
    tokenStore: await createTokenStore({
      dataDir: env.dataDir,
      configuredSecret: env.fileTokenSecret,
    }),
    cursorSigningSecret,
    cache: options.skipCache
      ? new NoopCacheStore()
      : await (async () => {
          const { SqliteCacheStore } = await import("./cache/sqlite-cache.js");
          return SqliteCacheStore.create(env.cacheDbPath ?? path.join(env.dataDir, "cache", "cache.sqlite"));
        })(),
  };
}
