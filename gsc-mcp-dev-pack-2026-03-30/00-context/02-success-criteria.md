# Success criteria

A v1 release is successful if all of the following are true:

## Functional
- Can list allowed sites.
- Can query performance data for a valid property and date range.
- Can page through Search Analytics using `rowLimit` + `startRow` or an opaque cursor wrapper.
- Can list and get sitemap details.
- Can inspect a URL that belongs to the property.
- Can reject a URL that is outside the property boundary.

## Safety and policy
- Read-only mode works without write scope.
- Write tools are disabled unless explicitly enabled.
- Site alias allowlists are enforced.
- The server never claims a live indexability test when using URL Inspection.
- The server does not expose a generic indexing tool.

## Data integrity
- Analytics responses include `accuracyClass` and reasons.
- The server preserves PT date semantics.
- High-cost detail requests are split or rejected predictably.
- Search appearance queries are wrapped in a helper flow rather than left as awkward raw API mechanics.

## Developer experience
- Config is simple and documented.
- There is a clear CLI for auth, inspection, serving, and diagnostics.
- Tests cover the planner and normalization logic.
- The repo includes a local example for MCP client configuration.

## Operability
- Errors are structured and helpful.
- Sensitive logs are redacted.
- stdout stays protocol-clean for `stdio`.
