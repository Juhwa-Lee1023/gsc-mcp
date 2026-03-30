# Cache, mirror, and sync strategy

## Layer 1 — live cache
Good for:
- sites list
- sitemaps list/get
- URL inspection
- finalized performance queries that are repeatedly asked

Suggested TTLs:
- sites/sitemaps: minutes
- URL inspection: around an hour
- finalized performance results: hours to days depending on date range
- fresh performance results: a few minutes

## Layer 2 — mirror store
A local mirror gives:
- lower quota pressure
- repeatability
- easier period comparison
- better auditability

## Layer 3 — sync worker
Later, add:
- daily probe for most recent available date
- daily finalized sync
- weekly reconciliation passes for recent ranges

## Layer 4 — bulk export adapter
Use BigQuery bulk export when:
- history is long
- detail is high-cardinality
- long-tail analysis matters

## Design rule
Do not build the sync worker into the model-facing MCP path.
Keep it as a separate operational concern.
