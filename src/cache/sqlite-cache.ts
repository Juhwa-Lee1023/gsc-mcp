import Database from "better-sqlite3";
import path from "node:path";

import type { CacheStore } from "../domain/types.js";
import { ensureDir } from "../utils/fs.js";

export class SqliteCacheStore implements CacheStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (namespace, key)
      );
    `);
  }

  static async create(dbPath: string): Promise<SqliteCacheStore> {
    await ensureDir(path.dirname(dbPath));
    return new SqliteCacheStore(dbPath);
  }

  async get<T>(namespace: string, key: string): Promise<T | null> {
    const row = this.db
      .prepare("SELECT value, expires_at FROM cache_entries WHERE namespace = ? AND key = ?")
      .get(namespace, key) as { value: string; expires_at: number } | undefined;
    if (!row) {
      return null;
    }
    if (row.expires_at <= Date.now()) {
      await this.delete(namespace, key);
      return null;
    }
    return JSON.parse(row.value) as T;
  }

  async set<T>(namespace: string, key: string, value: T, ttlSeconds: number): Promise<void> {
    this.db
      .prepare(`
        INSERT INTO cache_entries (namespace, key, expires_at, value)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(namespace, key) DO UPDATE
        SET expires_at = excluded.expires_at, value = excluded.value
      `)
      .run(namespace, key, Date.now() + ttlSeconds * 1000, JSON.stringify(value));
  }

  async delete(namespace: string, key: string): Promise<void> {
    this.db.prepare("DELETE FROM cache_entries WHERE namespace = ? AND key = ?").run(namespace, key);
  }

  async clearExpired(): Promise<void> {
    this.db.prepare("DELETE FROM cache_entries WHERE expires_at <= ?").run(Date.now());
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
