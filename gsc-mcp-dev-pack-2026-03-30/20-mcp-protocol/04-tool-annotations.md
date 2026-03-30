# Tool annotations are hints, not policy

## Official schema facts
The MCP schema includes tool annotations such as:
- `readOnlyHint`
- `destructiveHint`
- `idempotentHint`
- `openWorldHint`

The schema is explicit that these are **hints** and not guaranteed faithful descriptions of tool behavior.

## Why this matters
You cannot rely on annotations alone to protect dangerous actions.

## Product consequence
For this project:
- mark read tools with `readOnlyHint: true`
- if write tools exist, mark them appropriately
- still enforce policy server-side:
  - scope checks
  - feature flags
  - property allowlists
  - confirmation tokens for writes

## Sources
- https://modelcontextprotocol.io/specification/2025-11-25/schema
