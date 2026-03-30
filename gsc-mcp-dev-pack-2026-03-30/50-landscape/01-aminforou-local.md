# AminForou `mcp-gsc` (local)

## Observed strengths
- clearly positioned as a GSC MCP server for SEO use
- wide tool surface
- supports both OAuth and service account paths
- aims to work with many MCP clients

## Observed tradeoffs
- README mentions a complete list of 19 tools, which is a lot for models to plan around
- search analytics helpers expose `row_limit` with a default of 20 and max of 500 in that project, which is convenient for chat summaries but not aligned with the full Search Analytics API range
- open issues indicate real-world friction around domain properties and client execution setups

## What to borrow
- practical tool naming examples
- broad user-facing SEO prompt ideas

## What to avoid
- too many tools too early
- chat-optimized row limits becoming the implicit truth for the API
- policy and data caveat concerns being spread across many helpers

## Sources
- https://github.com/AminForou/mcp-gsc
