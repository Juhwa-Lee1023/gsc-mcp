# gsc-mcp

`gsc-mcp` is a narrow, read-only-first Search Console inspector/debugger with an MCP server and companion CLI.
It focuses on reliable property access, honest Search Console analytics, and a small tool surface that is easy to reason about for solo developers and local agent workflows.

This beta is intentionally not a broad Search Console management suite. It is best treated as a Search Console copilot for inspection, debugging, and careful reporting.
This package is meant to be run as a CLI or stdio MCP tool package, not consumed as a supported importable library API.

## v1 Beta Scope

This first version ships:

- `stdio` transport
- local OAuth token loading and refresh for Google Search Console
- alias-based, allowlisted property access
- read-only tools only
- PT-aware Search Console date handling
- Search Analytics query planning with accuracy metadata
- live API only, with no mirror or bulk-export routing in v1
- URL Inspection, sitemaps, and sites support
- SQLite-backed caching
- structured logs and redacted audit events

## Non-Goals

`gsc-mcp` v1 does not include:

- GA4, Bing, PageSpeed, or broad SEO-suite tooling
- generic URL indexing submission
- write tools enabled by default
- remote Streamable HTTP transport
- hosted auth portal or multi-account auth orchestration
- background sync workers or bulk-export routing

## Requirements

- Node.js 20 or newer
- `pnpm`
- a Google Cloud OAuth client with the Search Console APIs enabled

## Setup

1. Install dependencies.
2. Copy `.env.example` to `.env` and fill in OAuth values.
3. Run `gsc-mcp auth login --scope readonly` to link the local account. Auth commands only require `.env`.
4. Run `gsc-mcp auth status` if you want to confirm the local token state before configuring properties.
5. Copy `gsc-mcp.config.example.yaml` to `gsc-mcp.config.yaml` and define allowed properties before using service or MCP commands.

```bash
pnpm install
cp .env.example .env
pnpm dev auth login --scope readonly
pnpm dev auth status
cp gsc-mcp.config.example.yaml gsc-mcp.config.yaml
```

### `.env`

Use environment variables for OAuth and local storage settings:

```dotenv
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GSC_MCP_DATA_DIR=.gsc-mcp
GSC_MCP_CACHE_DB=
GSC_MCP_DEBUG=false
GSC_MCP_FILE_TOKEN_SECRET=
```

### `gsc-mcp.config.yaml`

Use config for property allowlists, tool policy, query policy, cache, and logging:

```yaml
google:
  defaultScope: readonly

properties:
  - alias: main
    siteUrl: sc-domain:example.com
    allowRead: true

toolPolicy:
  enabledTools:
    - gsc.sites.list
    - gsc.sites.get
    - gsc.performance.query
    - gsc.performance.search_appearance.list
    - gsc.url.inspect
    - gsc.sitemaps.list
    - gsc.sitemaps.get
  disabledTools: []
```

## Local Run

Auth commands work with `.env` only. Service commands and the MCP server still require an allowlist config.

Development:

```bash
pnpm dev doctor
pnpm dev serve stdio
pnpm dev sites list
```

Build and run the compiled binary:

```bash
pnpm build
pnpm start -- doctor
```

## Build And Package

Release-oriented verification:

```bash
pnpm release:check
```

The repository tracks a `pnpm` build-script allowlist in `pnpm-workspace.yaml` so `pnpm install --frozen-lockfile` can build the native cache dependency it actually needs for runtime commands.
`pnpm release:check` also includes a built CLI runtime smoke that initializes the cache-backed service path and expects a graceful `GOOGLE_ACCOUNT_NOT_LINKED` error before any live API call.

Create a tarball for publishing or inspection:

```bash
mkdir -p .tmp/pkg
pnpm pack --pack-destination .tmp/pkg
```

This beta package should only contain the built CLI, README, LICENSE, and example config/env files.

## CLI

- `gsc-mcp init` creates starter `.env` and `gsc-mcp.config.yaml` files if they are missing.
- `gsc-mcp auth login --scope readonly|write` links a local Google OAuth token. If browser auto-open fails, the CLI prints the authorization URL for manual use.
- `gsc-mcp auth upgrade --scope write` can request broader Google OAuth scope later, but it does not unlock additional beta tools or turn this build into a management suite.
- `gsc-mcp auth status` shows the current local token state.
- `gsc-mcp auth logout` deletes the locally stored OAuth token.
- `gsc-mcp config show` prints resolved config.
- `gsc-mcp doctor` prints local diagnostics.
- `gsc-mcp serve stdio` starts the MCP server.
- `gsc-mcp sites list` lists allowlisted sites visible to the linked Google account.
- `gsc-mcp performance query` runs a Search Analytics query.
- `gsc-mcp performance search-appearance` runs the official `searchAppearance` helper flow.
- `gsc-mcp sitemaps list` and `gsc-mcp sitemaps get` inspect sitemaps.
- `gsc-mcp url inspect [--force-refresh]` inspects an indexed URL for an allowlisted property and can bypass the local inspection cache.

## MCP Surface

### Tools

- `gsc.sites.list`
- `gsc.sites.get`
- `gsc.performance.query`
- `gsc.performance.search_appearance.list`
- `gsc.url.inspect`
- `gsc.sitemaps.list`
- `gsc.sitemaps.get`

### Resources

- `gsc://capabilities`
- `gsc://policies/current`
- `gsc://sites`
- `gsc://site/{site}/sitemaps`

### Prompts

- `gsc-summary`
- `gsc-compare-periods`
- `gsc-debug-url`
- `gsc-sitemap-audit`

## Search Console Caveats

Search Console data is not fully exhaustive, so `gsc-mcp` always exposes accuracy metadata instead of pretending every query is exact.
This beta should be used as an inspector/debugger, not as a guaranteed exhaustive export layer.

For performance responses, expect:

- `accuracyClass` with one of `exact`, `top_rows_only`, `fresh_incomplete`, or `top_rows_and_fresh`
- `reasons` explaining why the result may be incomplete
- `resolvedStartDatePT` and `resolvedEndDatePT` in PT semantics
- `responseAggregationType`, `dataState`, `firstIncompleteDate`, and `firstIncompleteHour` when available

Important caveats:

- `page` and `query` dimensions can return top-row-limited results
- even after daily shard pagination, page/query detail results still inherit live Search Console API top-row behavior and must not be treated as exhaustive exports
- fresh data can be incomplete even when the query shape is valid
- URL Inspection shows Google's indexed view, not a live fetch
- long summary queries are chunked by `queryPolicy.summaryMaxDays` within a bounded safety limit; long detail queries are either daily-split or rejected depending on range and query shape
- `sourcePreference` only supports `auto` and `live_api` in v1
- `fidelity=prefer_exact` is rejected for page/query detail requests because live API top-row behavior cannot guarantee exactness
- `dataState` defaults to `final`
- `type` is preferred over deprecated `searchType`

## Testing

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm runtime:smoke
pnpm pack:check
pnpm release:check
pnpm test
pnpm typecheck
pnpm build
```

For release workflow details, see [RELEASING.md](./RELEASING.md).

## Deferred For v1

Intentionally deferred to later phases:

- Streamable HTTP transport
- broad Search Console management workflows
- write tools enabled by default
- hosted auth portal
- auth session management beyond local login/status/logout
- bulk export or mirror-backed exact detail mode
- generic indexing submission
- GA4, Bing, and PageSpeed integration
- background sync workers

## Future HTTP Mode Notes

The v1 code keeps Google Search Console logic outside the MCP transport layer, so Streamable HTTP can be added later without rewriting planner, auth policy, normalization, or service code.

The expected next step is to add a second transport entrypoint that reuses the existing `GscService`, tool registrations, resources, and prompts while keeping the current stdio-first server as the default local mode.

## Notes

The server keeps stdout protocol-clean for MCP. Human-readable diagnostics go to stderr, and audit logging is redacted before it touches disk.

This repository is packaged for a narrow public beta as a read-only Search Console inspector/debugger. See [LICENSE](./LICENSE) for usage terms.
