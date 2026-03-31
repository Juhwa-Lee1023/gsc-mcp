import { execFileSync } from "node:child_process";

function parsePackOutput(stdout) {
  const jsonStart = stdout.indexOf("[");
  if (jsonStart === -1) {
    throw new Error("Could not find npm pack JSON output.");
  }
  return JSON.parse(stdout.slice(jsonStart));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const raw = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

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

process.stdout.write(
  `${JSON.stringify(
    {
      package: packInfo.name,
      version: packInfo.version,
      entryCount: packInfo.entryCount,
      files: filePaths,
    },
    null,
    2,
  )}\n`,
);
