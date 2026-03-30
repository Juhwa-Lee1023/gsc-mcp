# Search Analytics request shape

## Official request facts
- `startDate` and `endDate` are required.
- Dates are in `YYYY-MM-DD` and interpreted in **PT**.
- `dimensions[]` is optional and order matters for row keys.
- If no dimensions are provided, all values are combined into a single row.
- `type` supports:
  - `web`
  - `image`
  - `video`
  - `news`
  - `discover`
  - `googleNews`
- `searchType` is deprecated; use `type`.
- `aggregationType` can be `auto`, `byPage`, `byProperty`, and in some cases `byNewsShowcasePanel`.
- If you group or filter by page, you cannot aggregate by property.
- Results are sorted by clicks descending unless grouping by date, in which case they are sorted by date ascending.

## Important request semantics
- When `date` is one of the dimensions, days without data are omitted.
- The API returns zero or more rows; empty sets are valid successful results.

## Design implications
- Always echo the resolved PT date range in your response metadata.
- Prefer `type` over any legacy field.
- Reject invalid aggregation choices instead of guessing.
- Preserve dimension order exactly.

## Sources
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
