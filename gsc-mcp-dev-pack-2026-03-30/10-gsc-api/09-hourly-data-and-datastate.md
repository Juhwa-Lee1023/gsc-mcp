# Hourly data and `dataState`

## Official request facts
`dataState` supports:
- `final` — finalized data only
- `all` — includes fresh data
- `hourly_all` — includes hourly breakdown and may include partial data

Google documents:
- `first_incomplete_date` for `dataState=all` + date grouping
- `first_incomplete_hour` for `dataState=hourly_all` + hour grouping
- these metadata timestamps are in `America/Los_Angeles`

## Hourly support
Google added hourly Search Analytics support in 2025:
- a new `HOUR` dimension
- hourly data for up to 10 days
- `HOURLY_ALL` should be used when grouping by `HOUR`

## Product recommendation
- default to `final`
- use `all` only when freshness is explicitly needed
- use `hourly_all` only when the caller truly needs hour-level analysis
- propagate incomplete metadata into your normalized response
- treat hour-level data as inherently more volatile

## Sources
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/search/blog/2025/04/san-hourly-data
