import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function parsePackOutput(stdout) {
  const candidateStarts = [];

  for (let index = 0; index < stdout.length; index += 1) {
    if (stdout[index] === "[") {
      candidateStarts.push(index);
    }
  }

  for (let index = candidateStarts.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(stdout.slice(candidateStarts[index]).trim());
    } catch {
      // Ignore non-JSON log prefixes such as ANSI color sequences from prepack builds.
    }
  }

  throw new Error("Could not parse npm pack JSON output.");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkPackage(raw = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
})) {
  const result = parsePackOutput(raw);
  assert(Array.isArray(result) && result.length === 1, "Expected a single npm pack result.");

  const packInfo = result[0];
  assert(packInfo && Array.isArray(packInfo.files), "Expected npm pack to report packaged files.");

  const filePaths = packInfo.files.map((file) => file.path).sort();

  const requiredFiles = new Set([
    ".env.example",
    "LICENSE",
    "README.md",
    "dist/index.js",
    "gsc-mcp.config.example.yaml",
    "package.json",
  ]);

  for (const requiredFile of requiredFiles) {
    assert(filePaths.includes(requiredFile), `Package tarball is missing required file: ${requiredFile}`);
  }

  const forbiddenPatterns = [
    /^src\//,
    /^tests\//,
    /^node_modules\//,
    /^coverage\//,
    /^\.github\//,
    /^gsc-mcp-dev-pack-/,
    /^scripts\//,
    /^__MACOSX\//,
    /\.DS_Store$/,
  ];

  for (const filePath of filePaths) {
    const forbiddenPattern = forbiddenPatterns.find((pattern) => pattern.test(filePath));
    assert(!forbiddenPattern, `Package tarball includes an unexpected file: ${filePath}`);
  }

  return {
    package: packInfo.name,
    version: packInfo.version,
    entryCount: packInfo.entryCount,
    files: filePaths,
  };
}

export function main() {
  process.stdout.write(`${JSON.stringify(checkPackage(), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
