import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COMMAND_TIMEOUT_MS = 30_000;

function fail(message, details) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "gsc-mcp-runtime-smoke-"));
let shouldCleanup = false;

try {
  const envTemplate = await readFile(path.join(repoRoot, ".env.example"), "utf8");
  const configTemplate = await readFile(path.join(repoRoot, "gsc-mcp.config.example.yaml"), "utf8");

  await writeFile(
    path.join(tempDir, ".env"),
    envTemplate
      .replace("your-google-oauth-client-id", "test-client-id")
      .replace("your-google-oauth-client-secret", "test-client-secret"),
    "utf8",
  );
  await writeFile(path.join(tempDir, "gsc-mcp.config.yaml"), configTemplate, "utf8");

  const result = spawnSync("node", [path.join(repoRoot, "dist/index.js"), "sites", "list"], {
    cwd: tempDir,
    encoding: "utf8",
    timeout: COMMAND_TIMEOUT_MS,
    env: {
      ...process.env,
      GOOGLE_CLIENT_ID: "test-client-id",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
      GSC_MCP_DATA_DIR: path.join(tempDir, ".gsc-mcp"),
    },
  });

  if (result.error) {
    fail("Runtime smoke command failed to start.", {
      tempDir,
      timeoutMs: COMMAND_TIMEOUT_MS,
      error: result.error.message,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  if (result.signal) {
    fail("Runtime smoke command did not exit cleanly.", {
      tempDir,
      timeoutMs: COMMAND_TIMEOUT_MS,
      signal: result.signal,
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  if (result.status !== 1) {
    fail("Runtime smoke expected an unauthenticated failure with exit code 1.", {
      tempDir,
      timeoutMs: COMMAND_TIMEOUT_MS,
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stderr);
  } catch {
    fail("Runtime smoke expected JSON error output on stderr.", {
      tempDir,
      timeoutMs: COMMAND_TIMEOUT_MS,
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  if (parsed.code !== "GOOGLE_ACCOUNT_NOT_LINKED") {
    fail("Runtime smoke expected GOOGLE_ACCOUNT_NOT_LINKED after runtime initialization.", {
      tempDir,
      timeoutMs: COMMAND_TIMEOUT_MS,
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      parsed,
    });
  }

  shouldCleanup = true;
  process.stdout.write(
    `${JSON.stringify(
      {
        tempDir,
        command: "node dist/index.js sites list",
        timeoutMs: COMMAND_TIMEOUT_MS,
        status: result.status,
        errorCode: parsed.code,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  if (shouldCleanup) {
    await rm(tempDir, { recursive: true, force: true });
  }
}
