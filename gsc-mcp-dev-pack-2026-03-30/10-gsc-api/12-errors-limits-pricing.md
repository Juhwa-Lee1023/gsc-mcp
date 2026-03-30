# Errors, limits, and pricing

## Pricing
Google states the Search Console API is **free of charge**, but subject to usage limits.

## Error model
Google documents a common JSON error structure with:
- HTTP status code
- message
- structured error details
- domain / reason information

## Search Analytics limits
Google documents two kinds of constraints:
### Load quota
- short-term load quota (10-minute chunks)
- long-term load quota (1-day chunks)

Expensive patterns include:
- grouping or filtering by page
- grouping or filtering by query
- grouping/filtering by page **and** query together
- long date ranges
- repeatedly re-querying the same data

### QPS/QPM/QPD
Search Analytics examples include:
- per-site: 1,200 QPM
- per-user: 1,200 QPM
- per-project: 30,000,000 QPD and 40,000 QPM

## All other resources
Google also documents generic limits for the remaining resources.

## Product recommendation
Map Google failures into domain-specific structured errors, but preserve enough original context to debug quota or auth problems.

## Sources
- https://developers.google.com/webmaster-tools/pricing
- https://developers.google.com/webmaster-tools/v1/errors
- https://developers.google.com/webmaster-tools/limits
