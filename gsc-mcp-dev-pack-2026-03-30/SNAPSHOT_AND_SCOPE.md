# Snapshot and scope

This pack is a **design-and-build briefing** for a Google Search Console focused MCP server and supporting CLI.

## Snapshot date
- Snapshot date: **2026-03-30**
- Search Console references were checked against Google developer docs and Search Central blog posts available at that date.
- MCP references were checked against the public MCP specification pages available at that date.

## Main goal
Build a **small but production-minded** `gsc-mcp` implementation that starts with:
- TypeScript / Node
- local `stdio` transport first
- read-only by default
- strong property allowlists
- accurate handling of Search Console data caveats
- a clean path to later add sync workers and remote HTTP auth

## Non-goals for v1
- generic URL indexing submission
- broad SEO platform scope (GA4, Bing, PageSpeed correlation, etc.)
- multi-tenant hosted OAuth on day one
- giant “analysis engine” before the core API semantics are correct

## What is inside this pack
- official Google Search Console API facts
- official MCP protocol and security facts
- practical design recommendations specific to this project
- a repo layout and TypeScript implementation plan
- a landscape review of existing community GSC MCP servers
- a copy-paste prompt for a coding CLI

## How to use this pack
1. Read `README.md` first.
2. Read `PASTE_INTO_CODING_CLI.md`.
3. Keep `10-gsc-api/` open while implementing live API calls.
4. Keep `20-mcp-protocol/` open while implementing transports, auth, tools, resources, and prompts.
5. Keep `30-product-design/` open while implementing policy, caching, query planning, and error handling.

## Primary references
- https://developers.google.com/webmaster-tools/about
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data
- https://developers.google.com/webmaster-tools/limits
- https://developers.google.com/webmaster-tools/v1/how-tos/authorizing
- https://modelcontextprotocol.io/specification/2025-11-25
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
