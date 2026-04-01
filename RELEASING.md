# Releasing `gsc-mcp`

`gsc-mcp` is released as a CLI/MCP tool package for local agent workflows.
It is not published as a supported application library API.

## Beta Release Checklist

1. Start from a clean checkout on the branch you plan to release.
2. Install dependencies with the locked package manager version.
3. Confirm the tracked `pnpm-workspace.yaml` still allows the native/runtime build scripts the package depends on.
4. Run the full release verification.
5. Create a package tarball and inspect the output path.
6. Publish only after the README, examples, and capabilities still match the shipped surface.
7. If publishing as a public beta, make sure the repository, homepage, and issue tracker URLs in `package.json` resolve publicly for end users.

## Verification Commands

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

`pnpm release:check` runs:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm runtime:smoke`
- `pnpm pack:check`

`pnpm runtime:smoke` verifies that the built CLI can initialize the cache-backed runtime path from a fresh temp project and fails gracefully with `GOOGLE_ACCOUNT_NOT_LINKED` instead of crashing before auth.

## Create A Tarball

```bash
mkdir -p .tmp/pkg
pnpm pack --pack-destination .tmp/pkg
```

Expected result:

- one `.tgz` package under `.tmp/pkg`
- package contents limited to the built CLI, README, LICENSE, and example config/env files

## Manual Smoke Suggestions

Run these after building:

```bash
node dist/index.js --help
GSC_MCP_DATA_DIR=.tmp/release-smoke node dist/index.js auth status
```

## Release Positioning Check

Before publishing, confirm the package still presents itself as:

- read-only by default
- live API only
- a Search Console inspector/debugger/copilot
- not a broad management suite
- not a generic importable library

Also confirm these publication prerequisites:

- the package license still grants public use and redistribution rights
- the GitHub repository and issue tracker linked from `package.json` are public if this is being published as a public beta
