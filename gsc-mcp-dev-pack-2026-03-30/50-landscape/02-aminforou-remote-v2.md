# AminForou `google-search-console-mcp-v2` (remote edition)

## Observed strengths
- explicitly focuses on hosted OAuth UX
- frames the problem as multi-user remote access
- includes a user-facing auth portal idea
- calls out production concerns like HTTPS, CORS, token storage, and rate limiting

## Observed tradeoffs
- the README architecture still describes MCP over SSE and `/mcp/{user_id}/sse`, while modern MCP transport guidance now centers on Streamable HTTP
- the project describes SQLite by default and PostgreSQL for production, but remains fairly early
- exposing per-user API keys is simple, but a fuller MCP auth model may be more future-proof

## What to borrow
- the separation between browser login and agent access
- the operational framing of remote hosting

## What to improve
- align with current Streamable HTTP transport
- keep MCP auth and Google auth separate
- avoid client-token passthrough patterns

## Sources
- https://github.com/AminForou/google-search-console-mcp-v2
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
