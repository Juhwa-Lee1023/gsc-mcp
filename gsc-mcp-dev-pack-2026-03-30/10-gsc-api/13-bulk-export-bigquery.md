# Bulk export to BigQuery

## Official facts
Google introduced bulk data export to BigQuery for Search Console.
The Search Central blog explains:
- exports can be configured as a **daily data dump** into BigQuery
- export data includes all performance data **except anonymized queries**
- bulk export is **not affected by the daily data row limit**
- Google describes three main tables:
  - `searchdata_site_impression`
  - `searchdata_url_impression`
  - `ExportLog`

Google also published BigQuery efficiency guidance and positions bulk export as a way to:
- retain data longer
- analyze long-tail queries
- join Search Console with other sources

## Why this matters
For a local MCP wrapper, live API calls are enough.
For serious historical or high-cardinality analysis, bulk export can be the better source.

## Recommended architecture
Support future source routing:
- `live_api`
- `mirror`
- `bulk_export`
- `auto`

Do not block v1 on BigQuery support, but keep interfaces ready for it.

## Sources
- https://developers.google.com/search/blog/2023/02/bulk-data-export
- https://developers.google.com/search/blog/2023/06/bigquery-efficiency-tips
