# Accuracy metadata

## Goal
Every analytics response should communicate the likely trust level of the returned rows.

## Recommended field
`accuracyClass`

## Values
- `exact`
- `top_rows_only`
- `fresh_incomplete`
- `top_rows_and_fresh`

## Recommended companion fields
- `reasons[]`
- `resolvedStartDatePT`
- `resolvedEndDatePT`
- `responseAggregationType`
- `dataState`
- `firstIncompleteDate`
- `firstIncompleteHour`

## Example reasons
- `ANONYMIZED_QUERIES`
- `TOP_ROWS_LIMIT`
- `PAGE_OR_QUERY_DIMENSION`
- `FRESH_DATA_STATE`
- `API_ROW_EXPOSURE_LIMIT`
- `AUTO_AGGREGATION`

## Why this matters
This turns a vague SEO data adapter into an honest infrastructure primitive.
It reduces the chance that downstream models make strong claims from partial data.
