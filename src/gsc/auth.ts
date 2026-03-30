import http from "node:http";
import { randomBytes } from "node:crypto";

import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";

import { createDomainError } from "../domain/errors.js";
import type { EnvConfig, ScopeMode, TokenRecord, TokenStore } from "../domain/types.js";
import { openSystemBrowser } from "../utils/browser.js";
import { GOOGLE_SCOPES } from "./scopes.js";

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
}> {
  const tokenRecord = await tokenStore.get();
  if (!tokenRecord) {
    throw createDomainError("GOOGLE_ACCOUNT_NOT_LINKED", "No stored Google token found. Run `gsc-mcp auth login` first.");
  }
  const oauthClient = createOAuthClient(env, "http://127.0.0.1");
  oauthClient.setCredentials(tokenRecord.credentials);
  return {
    oauthClient,
    tokenRecord,
  };
}

export async function loginWithLoopback(env: EnvConfig, tokenStore: TokenStore, scopeMode: ScopeMode): Promise<TokenRecord> {
  const state = randomBytes(16).toString("hex");
  const { server, redirectUri, codePromise } = await startLoopbackServer(state);
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
    await openSystemBrowser(authUrl);
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
    throw createDomainError("AUTH_CALLBACK_FAILED", "OAuth login failed.", false, {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    server.close();
  }
}

async function startLoopbackServer(state: string): Promise<{
  server: http.Server;
  redirectUri: string;
  codePromise: Promise<string>;
}> {
  let resolveCode: ((code: string) => void) | undefined;
  let rejectCode: ((reason?: unknown) => void) | undefined;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    const error = url.searchParams.get("error");
    const returnedState = url.searchParams.get("state");
    const code = url.searchParams.get("code");

    if (error) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end(`OAuth failed: ${error}\n`);
      rejectCode?.(new Error(error));
      return;
    }
    if (!code || returnedState !== state) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end("Invalid OAuth callback.\n");
      rejectCode?.(new Error("Invalid state or code"));
      return;
    }

    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end("Authorization complete. You can return to the terminal.\n");
    resolveCode?.(code);
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
