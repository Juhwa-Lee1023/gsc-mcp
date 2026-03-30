# Search Analytics data caveats

## Privacy filtering
Google explicitly states that some queries are anonymized to protect user privacy.
- anonymized queries do not appear as rows
- anonymized queries are included in totals unless you filter by query
- this is one reason totals and listed rows can disagree

## Daily row limit
Google also documents a daily data row limit.
Even if you paginate correctly, API exposure is capped per day / site / search type.

## Chart vs table discrepancies
The Search Console help docs explain that chart totals can differ from table totals for multiple reasons, including:
- chart data aggregated by property
- table data often aggregated by property, but by page when grouped by page or search appearance
- anonymized queries omitted from tables
- row truncation
- page/search appearance grouping differences

## What this means for `gsc-mcp`
Never imply:
- “these rows are the whole universe of queries”
- “table sum equals total site clicks”
- “page/query detail is complete”

Instead return accuracy metadata and surface reasons such as:
- `ANONYMIZED_QUERIES`
- `TOP_ROWS_ONLY`
- `PAGE_OR_QUERY_GROUPING`
- `ROW_EXPOSURE_LIMIT`

## Sources
- https://developers.google.com/search/blog/2022/10/performance-data-deep-dive
- https://support.google.com/webmasters/answer/7576553?hl=en
