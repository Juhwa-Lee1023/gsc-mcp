import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import path from "node:path";

import type { TokenRecord, TokenStore } from "../domain/types.js";
import { fileExists, readJsonFile, writeJsonFileAtomic } from "../utils/fs.js";
import { deleteMacosKeychain, loadMacosKeychain, saveMacosKeychain } from "./keychain.js";

interface EncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function encrypt(record: TokenRecord, secret: string): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(record), "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

function decrypt(payload: EncryptedPayload, secret: string): TokenRecord {
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), Buffer.from(payload.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as TokenRecord;
}

class EncryptedFileTokenStore implements TokenStore {
  readonly kind = "encrypted-file";

  constructor(
    private readonly recordPath: string,
    private readonly keyPath: string,
    private readonly configuredSecret?: string,
  ) {}

  async get(): Promise<TokenRecord | null> {
    if (!(await fileExists(this.recordPath))) {
      return null;
    }
    return decrypt(await readJsonFile<EncryptedPayload>(this.recordPath), await this.resolveSecret());
  }

  async set(record: TokenRecord): Promise<void> {
    await writeJsonFileAtomic(this.recordPath, encrypt(record, await this.resolveSecret()));
  }

  async delete(): Promise<void> {
    const fs = await import("node:fs/promises");
    await fs.rm(this.recordPath, { force: true });
  }

  private async resolveSecret(): Promise<string> {
    if (this.configuredSecret) {
      return this.configuredSecret;
    }
    if (await fileExists(this.keyPath)) {
      const fs = await import("node:fs/promises");
      return (await fs.readFile(this.keyPath, "utf8")).trim();
    }
    const fs = await import("node:fs/promises");
    const secret = randomBytes(32).toString("base64url");
    await fs.mkdir(path.dirname(this.keyPath), { recursive: true });
    await fs.writeFile(this.keyPath, `${secret}\n`, { mode: 0o600 });
    return secret;
  }
}

class MacOsKeychainTokenStore implements TokenStore {
  readonly kind = "macos-keychain";

  async get(): Promise<TokenRecord | null> {
    const payload = await loadMacosKeychain();
    return payload ? (JSON.parse(payload) as TokenRecord) : null;
  }

  async set(record: TokenRecord): Promise<void> {
    await saveMacosKeychain(JSON.stringify(record));
  }

  async delete(): Promise<void> {
    await deleteMacosKeychain();
  }
}

class CompositeTokenStore implements TokenStore {
  readonly kind = "composite";

  constructor(
    private readonly primary: TokenStore | null,
    private readonly fallback: TokenStore,
  ) {}

  async get(): Promise<TokenRecord | null> {
    return (await this.primary?.get()) ?? this.fallback.get();
  }

  async set(record: TokenRecord): Promise<void> {
    if (this.primary) {
      try {
        await this.primary.set(record);
        return;
      } catch {
        // Fall through to file fallback.
      }
    }
    await this.fallback.set(record);
  }

  async delete(): Promise<void> {
    await this.primary?.delete().catch(() => undefined);
    await this.fallback.delete();
  }
}

export async function createTokenStore(options: {
  dataDir: string;
  configuredSecret?: string;
}): Promise<TokenStore> {
  const fallback = new EncryptedFileTokenStore(
    path.join(options.dataDir, "auth", "tokens.enc.json"),
    path.join(options.dataDir, "auth", "token.key"),
    options.configuredSecret,
  );
  if (process.platform === "darwin") {
    return new CompositeTokenStore(new MacOsKeychainTokenStore(), fallback);
  }
  return fallback;
}
