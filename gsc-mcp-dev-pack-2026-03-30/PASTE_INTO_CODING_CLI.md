# Paste into coding CLI

Below are two ways to use this pack.

## Option A — unzip the pack into your repo planning folder
```bash
mkdir -p ./.planning
unzip /path/to/gsc-mcp-dev-pack-2026-03-30.zip -d ./.planning/gsc-mcp-dev-pack
```

## Option B — keep it elsewhere and read it manually
Any location is fine as long as the coding agent can access the Markdown files.

## What to paste into the coding CLI
```text
# Paste into your coding CLI

Use this as the **single project instruction** for Claude Code / Codex CLI / Cursor agent chat / similar coding agents.

---

You are building a new project called **gsc-mcp**.

## High-level objective
Implement a **Google Search Console focused MCP server and companion CLI** with the following priorities:

1. **Correctness over feature count**
2. **Read-only by default**
3. **TypeScript / Node 20+**
4. **`stdio` first**
5. **Small tool surface**
6. **Accurate handling of Search Console data caveats**
7. **A clean migration path to remote Streamable HTTP later**

## Read these local docs first
Before writing code, read the knowledge pack in:
- `./.planning/gsc-mcp-dev-pack/README.md`
- `./.planning/gsc-mcp-dev-pack/10-gsc-api/`
- `./.planning/gsc-mcp-dev-pack/20-mcp-protocol/`
- `./.planning/gsc-mcp-dev-pack/30-product-design/`
- `./.planning/gsc-mcp-dev-pack/40-implementation/`

Do not skip the docs. Build from them.

## Product shape
Build **one repo** containing:
- a reusable Search Console core client layer
- an MCP server package
- a local CLI package
- tests
- docs

## v1 hard requirements
### Transport and scope
- Implement **local `stdio` MCP** first.
- Do **not** implement hosted OAuth / remote HTTP in the first pass unless you only scaffold interfaces.
- Default Google scope must be `https://www.googleapis.com/auth/webmasters.readonly`.
- Write scope (`https://www.googleapis.com/auth/webmasters`) must be optional and off by default.

### Must-have MCP tools
Implement these read-only tools:
- `gsc.sites.list`
- `gsc.sites.get`
- `gsc.performance.query`
- `gsc.performance.search_appearance.list`
- `gsc.url.inspect`
- `gsc.sitemaps.list`
- `gsc.sitemaps.get`

Do **not** ship generic indexing submission as a normal tool.

Optional write tools may exist behind a feature flag and must be disabled by default:
- `gsc.sitemaps.submit`
- `gsc.sitemaps.delete`
- `gsc.sites.add`
- `gsc.sites.delete`

### Policy and safety requirements
You must implement all of the following:
- property allowlist by alias
- read-only default mode
- tool capability flags
- strict `siteUrl` normalization
- PT date handling for Search Analytics requests
- structured error mapping
- caching
- audit logging
- explicit `accuracyClass` metadata on analytics responses
- query splitting rules for expensive requests
- no claims that URL Inspection is a live crawl
- no generic `request_indexing` tool in v1

### Search Analytics requirements
The implementation must understand:
- `rowLimit` max 25,000
- `startRow` pagination
- up to 50,000 rows/day/site/type exposure in the API
- page/query detail queries are more expensive and may lose data
- chart-vs-table discrepancies
- anonymized queries
- `dataState=final|all|hourly_all`
- `first_incomplete_date` / `first_incomplete_hour`
- PT (`America/Los_Angeles`) date semantics
- search appearance requires a two-step flow

### Accuracy metadata
Every analytics response must include:
- resolved site URL
- resolved PT date range
- search type
- aggregation type
- data state
- `accuracyClass` with one of:
  - `exact`
  - `top_rows_only`
  - `fresh_incomplete`
  - `top_rows_and_fresh`
- `reasons[]`

### Query planner
Implement a planner layer, not direct pass-through everywhere.
Rules:
- summary queries can span longer ranges
- page/query detail queries should split more aggressively
- expensive requests should be downgraded, split, or rejected with helpful structured errors
- exact historical, high-cardinality analysis should be designed to route to future mirror/bulk-export sources later

## Recommended architecture
Use a monorepo layout such as:
- `packages/core`
- `packages/mcp-server`
- `packages/cli`
- `packages/shared`
- `tests/`
- `docs/`

### Core package
Responsibilities:
- Google auth bootstrap
- Search Console REST client
- `siteUrl` normalization
- query planner
- response normalization
- error mapping
- cache abstraction
- audit abstraction
- policy checks

### MCP package
Responsibilities:
- MCP `stdio` server
- tool registration
- resource registration
- prompt registration
- request validation
- feature-flagged write tools

### CLI package
Responsibilities:
- `init`
- `auth login`
- `auth upgrade`
- `serve stdio`
- `sites list`
- `sync probe` (scaffold only is acceptable in v1 if clearly marked)
- config inspection commands

## Config model
Support a config file like:
```yaml
google:
  defaultScope: readonly

properties:
  - alias: main
    siteUrl: sc-domain:example.com
    allowRead: true
    allowWrite: false

queryPolicy:
  defaultDataState: final
  maxInteractiveDays:
    summary: 90
    detail: 31
  splitDailyAfterDays:
    detail: 7
  blockExactWithPageOrQueryWithoutBulkExport: true

writePolicy:
  enabled: false
  requireConfirmation: true

cache:
  provider: sqlite
```

## Tool contracts
Use Zod for runtime validation and expose clean JSON schemas.

### `gsc.performance.query` input
Include at least:
- `site`
- `startDate`
- `endDate`
- `type`
- `dimensions`
- `filters`
- `aggregationType`
- `dataState`
- `fidelity`
- `pageSize`
- `cursor`

### `gsc.performance.query` output
Return:
- `rows`
- `pageInfo`
- `meta`

`meta` must include the accuracy fields listed above.

## Resources and prompts
Also expose lightweight MCP resources and prompts.

### Resources
Implement at least:
- `gsc://capabilities`
- `gsc://policies/current`
- `gsc://sites`
- `gsc://site/{site}/sitemaps`

### Prompts
Implement at least:
- `gsc-summary`
- `gsc-compare-periods`
- `gsc-debug-url`
- `gsc-sitemap-audit`

## Security requirements
Even though v1 is local-first:
- prefer `stdio`
- never write non-MCP output to stdout
- log to stderr only
- keep tokens in OS keychain if available; otherwise encrypted local storage
- redact sensitive log values
- prepare interfaces for future HTTP auth without implementing token passthrough

## Testing requirements
Write tests for:
- site URL normalization
- property alias resolution
- query planner decisions
- row-limit pagination behavior
- accuracy metadata generation
- error mapping
- URL-inspection property boundary validation
- write-tool gating
- config parsing

Also include at least one integration-style test with mocked Google API responses.

## Documentation requirements
Create:
- `README.md`
- `.env.example`
- `docs/architecture.md`
- `docs/tool-contracts.md`
- `docs/configuration.md`
- `docs/security.md`
- `docs/development.md`

## Delivery format
Work in phases:
1. repo skeleton
2. core client + config + policy layer
3. read-only MCP tools
4. CLI commands
5. tests
6. docs
7. optional write-tool scaffolding

At the end:
- summarize what was implemented
- list anything intentionally deferred
- list commands to run locally
- show example `.mcp.json` configuration for a local client

## Strict exclusions
Do not:
- add a normal-purpose indexing tool
- conflate Search Console with GA4/Bing in v1
- hide Search Console data caveats
- silently assume chart totals equal table totals
- silently assume query/page outputs are complete

## Quality bar
This should feel like a **small, sharp, reliable infrastructure component**, not a big SEO kitchen sink.

Start now by:
1. inspecting the repo
2. creating the package layout
3. writing the core config/types layer
4. implementing the Google auth bootstrap
5. implementing `gsc.sites.list` end-to-end
6. then expanding to the remaining read-only tools

---
```
