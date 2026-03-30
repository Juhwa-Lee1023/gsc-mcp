# gsc-mcp dev pack

This archive is a **planning and implementation pack** for building a Google Search Console focused MCP server and CLI.

## Recommended reading order
1. `SNAPSHOT_AND_SCOPE.md`
2. `CONTENTS.md`
3. `PASTE_INTO_CODING_CLI.md`
4. `00-context/`
5. `10-gsc-api/`
6. `20-mcp-protocol/`
7. `30-product-design/`
8. `40-implementation/`
9. `50-landscape/`
10. `60-appendix/`

## Folder guide
- `00-context/` — project framing, scope, and acceptance criteria
- `10-gsc-api/` — official Search Console API behavior, caveats, limits, and adjacent Google features
- `20-mcp-protocol/` — MCP primitives, transports, auth, and security
- `30-product-design/` — opinionated design for this specific project
- `40-implementation/` — repo layout, interfaces, CLI shape, env config, testing, rollout
- `50-landscape/` — notes on existing community GSC MCP servers and the gap this project should fill
- `60-appendix/` — glossary, open questions, and consolidated links

## File index
| Path | Title | What it contains |
|---|---|---|
| `00-context/00-project-summary.md` | Project summary | One-page summary of what should be built and why the product should stay narrow. |
| `00-context/01-v1-goals-and-non-goals.md` | V1 goals and non-goals | Exact scope boundary for the first release so implementation does not sprawl. |
| `00-context/02-success-criteria.md` | Success criteria | Concrete acceptance criteria the implementation should satisfy before calling v1 done. |
| `10-gsc-api/00-api-surface.md` | Search Console API surface | What the official API covers and what this project should map directly. |
| `10-gsc-api/01-auth-scopes.md` | Auth and scopes | Official auth requirements, scope split, and what that implies for local and future remote modes. |
| `10-gsc-api/02-property-types-and-siteurl-format.md` | Property types and siteUrl format | Domain vs URL-prefix properties, exact formatting, and normalization rules the code should enforce. |
| `10-gsc-api/03-sites-resource.md` | Sites resource | How listing, adding, and deleting sites works and how permissions should be surfaced. |
| `10-gsc-api/04-search-analytics-request-shape.md` | Search Analytics request shape | Required fields, supported dimensions, type values, aggregation behavior, and sorting semantics. |
| `10-gsc-api/05-search-analytics-pagination-and-row-limits.md` | Search Analytics pagination and row limits | Hard row limits, API defaults, and how pagination should be wrapped in the product. |
| `10-gsc-api/06-search-analytics-data-caveats.md` | Search Analytics data caveats | Privacy filtering, anonymized queries, top-row behavior, and why totals can disagree with listed rows. |
| `10-gsc-api/07-search-analytics-aggregation.md` | Aggregation by property vs by page | How metrics differ across property/page aggregation and why the server should expose aggregation metadata. |
| `10-gsc-api/08-search-appearance-two-step.md` | Search appearance two-step flow | The awkward Search Console API pattern for search appearance and how the server should hide it. |
| `10-gsc-api/09-hourly-data-and-datastate.md` | Hourly data and dataState | Final vs fresh data, hourly support, incomplete metadata, and time zone implications. |
| `10-gsc-api/10-url-inspection.md` | URL Inspection | What the API can and cannot do, quotas, and the validation rules the server should enforce. |
| `10-gsc-api/11-sitemaps.md` | Sitemaps | Listing, reading, submitting, and deleting sitemaps, plus why sitemap write tools are the least risky write surface. |
| `10-gsc-api/12-errors-limits-pricing.md` | Errors, limits, and pricing | Global error format, Search Analytics load constraints, URL Inspection quotas, and pricing. |
| `10-gsc-api/13-bulk-export-bigquery.md` | Bulk export to BigQuery | Why bulk export matters for long-range or high-cardinality analysis and how it should relate to the live API. |
| `10-gsc-api/14-indexing-api-restrictions.md` | Why generic indexing should stay out of v1 | Official Indexing API restrictions and why a general-purpose indexing tool is a bad default. |
| `20-mcp-protocol/00-mcp-roles-and-primitives.md` | MCP roles and primitives | Host, client, server, JSON-RPC, and the three main server primitives: tools, resources, prompts. |
| `20-mcp-protocol/01-stdio-transport.md` | STDIO transport | Why stdio should be the first transport, and the strict stdout/stderr rules the implementation must honor. |
| `20-mcp-protocol/02-streamable-http.md` | Streamable HTTP | What the modern remote transport expects and how to prepare for it without implementing it first. |
| `20-mcp-protocol/03-authorization.md` | MCP authorization | How remote MCP auth differs from Google API auth and why token audience separation matters. |
| `20-mcp-protocol/04-tool-annotations.md` | Tool annotations are hints, not policy | What readOnlyHint/destructiveHint mean and why server-side policy still matters. |
| `20-mcp-protocol/05-resources-and-prompts.md` | Resources and prompts | How to use MCP resources and prompts so the server is more than a bag of tools. |
| `20-mcp-protocol/06-security-threats.md` | Security threat model | Confused deputy, token passthrough, SSRF, redirect validation, localhost safety, and local server considerations. |
| `30-product-design/00-overall-architecture.md` | Overall architecture | Recommended split between core client, MCP adapter, CLI, and later sync / remote components. |
| `30-product-design/01-permission-model.md` | Permission model | How Google scopes, local allowlists, tool capabilities, and optional write confirmation fit together. |
| `30-product-design/02-tool-surface-v1.md` | Tool surface v1 | The exact MCP tools, resources, and prompts recommended for the first version. |
| `30-product-design/03-query-planner.md` | Query planner | A planner layer that protects cost, correctness, and explanation quality instead of exposing raw API calls directly. |
| `30-product-design/04-accuracy-metadata.md` | Accuracy metadata | A normalized response contract that admits when results are top-rows-only, fresh, or both. |
| `30-product-design/05-cache-mirror-sync.md` | Cache, mirror, and sync strategy | How to combine short-lived live caching with a later daily mirror worker and optional BigQuery source. |
| `30-product-design/06-remote-auth-portal.md` | Future remote auth portal | The hosted architecture to build later, without mixing MCP auth and Google auth. |
| `30-product-design/07-logging-privacy-audit.md` | Logging, privacy, and audit | What to log, what to redact, and how to treat search query data carefully. |
| `30-product-design/08-error-model.md` | Error model | Structured domain errors for callers while preserving enough original context to debug failures. |
| `40-implementation/00-repo-layout.md` | Repo layout | Suggested monorepo structure with package responsibilities. |
| `40-implementation/01-typescript-stack.md` | TypeScript stack | Recommended runtime, package tools, validation library, and HTTP client choices. |
| `40-implementation/02-core-interfaces-and-zod.md` | Core interfaces and Zod schemas | Suggested interfaces for config, planner input/output, and main tool contracts. |
| `40-implementation/03-cli-commands.md` | CLI commands | Suggested command surface for local auth, config, diagnostics, and running the MCP server. |
| `40-implementation/04-env-vars-and-config.md` | Env vars and config | What should live in environment variables vs a checked-in config file. |
| `40-implementation/05-test-plan.md` | Test plan | Unit, integration, and contract test coverage the project should have from the start. |
| `40-implementation/06-rollout-plan.md` | Rollout plan | A practical phased plan from local v1 to future remote and bulk-export-aware versions. |
| `50-landscape/00-existing-servers-overview.md` | Existing server landscape | A high-level comparison of the main community GSC MCP servers and what each optimizes for. |
| `50-landscape/01-aminforou-local.md` | AminForou local server notes | Observed traits of `mcp-gsc` and the parts worth borrowing or avoiding. |
| `50-landscape/02-aminforou-remote-v2.md` | AminForou remote v2 notes | What the hosted remote concept gets right and where it diverges from modern MCP guidance. |
| `50-landscape/03-shin-sibainu.md` | Shin-sibainu server notes | Why the Shin-sibainu server is a useful local reference and where policy risks remain. |
| `50-landscape/04-surendranb.md` | surendranb server notes | Why the service-account-first Python server is operationally useful but intentionally narrow. |
| `50-landscape/05-saurabhsharma2u.md` | saurabhsharma2u server notes | Why the Saurabh project is more platform than wrapper and what lessons it offers. |
| `50-landscape/06-gap-analysis.md` | Gap analysis | The specific product gap this project is meant to fill. |
| `60-appendix/00-glossary.md` | Glossary | Definitions for Search Console and MCP terms used throughout the pack. |
| `60-appendix/01-open-questions.md` | Open questions | Things the implementation can defer or choose later without blocking the first version. |
| `60-appendix/02-reference-links.md` | Reference links | Consolidated list of official docs and community repos used for this pack. |
| `CONTENTS.md` | Contents index | Standalone root index describing what every Markdown file contains. |
| `PASTE_INTO_CODING_CLI.md` | Paste into coding CLI | A long-form instruction block you can paste directly into a coding CLI chat to drive implementation. |
| `README.md` | Pack index | Root guide that explains what every file in this pack contains and suggests a reading order. |
| `SNAPSHOT_AND_SCOPE.md` | Snapshot and scope | What this pack covers, what it intentionally excludes, and the date context for all references. |

## Notes
- This pack intentionally separates **official facts**, **opinionated design**, and **community landscape notes**.
- Start with the context, then official API behavior, then MCP protocol/security, then the design files.
- Many docs are deliberately small so a coding agent can read only the relevant chunk.
