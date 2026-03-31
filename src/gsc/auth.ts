import http from "node:http";
import { randomBytes } from "node:crypto";

import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";

import { createDomainError } from "../domain/errors.js";
import type { EnvConfig, Logger, ScopeMode, TokenRecord, TokenStore } from "../domain/types.js";
import { stableHash } from "../utils/crypto.js";
import { openSystemBrowser } from "../utils/browser.js";
import { GOOGLE_SCOPES } from "./scopes.js";

const DEFAULT_LOOPBACK_TIMEOUT_MS = 5 * 60 * 1000;

interface LoginWithLoopbackOptions {
  timeoutMs?: number;
  onManualAuthorizationUrl?: (authUrl: string, details: { browserError: string }) => void;
}

export function createOAuthClient(env: EnvConfig, redirectUri: string): OAuth2Client {
  return new OAuth2Client({
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    redirectUri,
  });
}

export async function createAuthorizedClient(env: EnvConfig, tokenStore: TokenStore): Promise<{
  oauthClient: OAuth2Client;
  tokenRecord: TokenRecord;
}>;
export async function createAuthorizedClient(
  env: EnvConfig,
  tokenStore: TokenStore,
  logger: Pick<Logger, "warn">,
): Promise<{
  oauthClient: OAuth2Client;
  tokenRecord: TokenRecord;
}>;
export async function createAuthorizedClient(
  env: EnvConfig,
  tokenStore: TokenStore,
  logger?: Pick<Logger, "warn">,
): Promise<{
  oauthClient: OAuth2Client;
  tokenRecord: TokenRecord;
}> {
  const storedTokenRecord = await tokenStore.get();
  if (!storedTokenRecord) {
    throw createDomainError("GOOGLE_ACCOUNT_NOT_LINKED", "No stored Google token found. Run `gsc-mcp auth login` first.");
  }
  const oauthClient = createOAuthClient(env, "http://127.0.0.1");
  let tokenRecord = storedTokenRecord;
  oauthClient.setCredentials(tokenRecord.credentials);
  oauthClient.on("tokens", (tokens) => {
    if (Object.keys(tokens).length === 0) {
      return;
    }
    tokenRecord = {
      ...tokenRecord,
      credentials: {
        ...tokenRecord.credentials,
        ...tokens,
      },
      updatedAt: new Date().toISOString(),
    };
    void tokenStore.set(tokenRecord).catch((error) => {
      logger?.warn("Failed to persist refreshed Google OAuth token", {
        tokenStore: tokenStore.kind,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
  return {
    oauthClient,
    tokenRecord,
  };
}

export async function loginWithLoopback(
  env: EnvConfig,
  tokenStore: TokenStore,
  scopeMode: ScopeMode,
  options: LoginWithLoopbackOptions = {},
): Promise<TokenRecord> {
  const state = randomBytes(16).toString("hex");
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOOPBACK_TIMEOUT_MS;
  const { server, redirectUri, codePromise } = await startLoopbackServer(state, timeoutMs);
  const oauthClient = createOAuthClient(env, redirectUri);
  const verifier = await oauthClient.generateCodeVerifierAsync();
  const authUrl = oauthClient.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: [GOOGLE_SCOPES[scopeMode]],
    state,
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: verifier.codeChallenge,
  });

  try {
    try {
      await openSystemBrowser(authUrl);
    } catch (error) {
      options.onManualAuthorizationUrl?.(authUrl, {
        browserError: error instanceof Error ? error.message : String(error),
      });
    }
    const code = await codePromise;
    const tokenResponse = await oauthClient.getToken({
      code,
      codeVerifier: verifier.codeVerifier,
      redirect_uri: redirectUri,
    });
    oauthClient.setCredentials(tokenResponse.tokens);
    const record: TokenRecord = {
      scopeMode,
      credentials: oauthClient.credentials,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await tokenStore.set(record);
    return record;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const userMessage = errorMessage.includes("Timed out waiting for OAuth callback")
      ? "Timed out waiting for the OAuth callback. Re-run the auth command and open the printed URL manually if needed."
      : "OAuth login failed.";
    throw createDomainError("AUTH_CALLBACK_FAILED", userMessage, false, {
      error: errorMessage,
      authUrl,
      timeoutMs,
    });
  } finally {
    server.close();
  }
}

export function createAccountCacheScope(tokenRecord: TokenRecord): string {
  return stableHash({
    scopeMode: tokenRecord.scopeMode,
    refreshToken: tokenRecord.credentials.refresh_token ?? null,
    idToken: tokenRecord.credentials.id_token ?? null,
    createdAt: tokenRecord.createdAt,
  });
}

async function startLoopbackServer(state: string, timeoutMs: number): Promise<{
  server: http.Server;
  redirectUri: string;
  codePromise: Promise<string>;
}> {
  let settled = false;
  let timeoutHandle: NodeJS.Timeout | undefined;
  let resolvePromise: ((code: string) => void) | undefined;
  let rejectPromise: ((reason?: unknown) => void) | undefined;
  const finishResolve = (code: string) => {
    if (settled) {
      return;
    }
    settled = true;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    resolvePromise?.(code);
  };
  const finishReject = (reason?: unknown) => {
    if (settled) {
      return;
    }
    settled = true;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    rejectPromise?.(reason);
  };
  const codePromise = new Promise<string>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  timeoutHandle = setTimeout(() => {
    finishReject(new Error(`Timed out waiting for OAuth callback after ${Math.round(timeoutMs / 1000)} seconds.`));
  }, timeoutMs);
  timeoutHandle.unref?.();

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    const error = url.searchParams.get("error");
    const returnedState = url.searchParams.get("state");
    const code = url.searchParams.get("code");

    if (error) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end(`OAuth failed: ${error}\n`);
      finishReject(new Error(error));
      return;
    }
    if (!code || returnedState !== state) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end("Invalid OAuth callback.\n");
      finishReject(new Error("Invalid state or code"));
      return;
    }

    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end("Authorization complete. You can return to the terminal.\n");
    finishResolve(code);
  });
  server.once("close", () => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind loopback server"));
        return;
      }
      resolve({
        server,
        redirectUri: `http://127.0.0.1:${address.port}/oauth2callback`,
        codePromise,
      });
    });
  });
}
