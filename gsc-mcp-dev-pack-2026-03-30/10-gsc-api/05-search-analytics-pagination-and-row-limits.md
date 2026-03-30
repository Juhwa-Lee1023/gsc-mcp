# Search Analytics pagination and row limits

## Official facts
- `rowLimit` valid range: **1–25,000**
- default `rowLimit`: **1,000**
- `startRow` is a zero-based offset
- to page, re-run the same query with a larger `startRow`
- Google’s “all your data” guide recommends increasing `startRow` by **25,000** until you get an empty page
- the Search Analytics API exposes up to **50,000 rows per day per site per search type**, sorted by clicks
- Google’s performance deep dive reiterates:
  - UI export max: 1,000 rows
  - API / Looker Studio upper limit: 50,000 rows per day per site per type
  - page 1 is typically rows 1–25,000, page 2 is 25,001–50,000

## Product recommendation
Wrap raw `startRow` in an opaque cursor for external callers, but keep the raw offset logic internally.

## Important honesty rule
A paginated result set is still not necessarily “all data” in the colloquial sense:
- the 50k/day/type exposure limit still applies
- privacy filtering still applies
- high-cardinality queries can still be partial

## Sources
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data
- https://developers.google.com/search/blog/2022/10/performance-data-deep-dive
