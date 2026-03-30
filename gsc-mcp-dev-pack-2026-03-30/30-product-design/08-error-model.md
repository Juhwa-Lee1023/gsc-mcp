# Error model

## Why custom errors
Google returns generic API errors, but the MCP layer should expose more actionable, domain-specific error codes.

## Recommended top-level shape
```json
{
  "code": "PROPERTY_NOT_ALLOWED",
  "message": "The requested site alias is not allowed by local policy.",
  "retryable": false,
  "details": {}
}
```

## Suggested codes
- `GOOGLE_ACCOUNT_NOT_LINKED`
- `WRITE_SCOPE_REQUIRED`
- `PROPERTY_NOT_ALLOWED`
- `SITE_ALIAS_NOT_FOUND`
- `INVALID_SITE_URL`
- `URL_OUTSIDE_PROPERTY`
- `HIGH_CARDINALITY_RANGE_UNSAFE`
- `TOP_ROWS_ONLY_RESULT`
- `FRESH_DATA_INCOMPLETE`
- `QUOTA_SHORT_TERM_EXCEEDED`
- `QUOTA_LONG_TERM_EXCEEDED`
- `CONFIRMATION_REQUIRED`
- `UNSUPPORTED_INDEXING_REQUEST`

## Mapping rule
Preserve original Google HTTP status and reason in `details.original` where useful, but do not force every caller to parse raw Google errors.
