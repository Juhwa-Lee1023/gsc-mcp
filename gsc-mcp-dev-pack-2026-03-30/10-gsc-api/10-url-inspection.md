# URL Inspection

## Official facts
- endpoint: `urlInspection.index.inspect`
- requires a URL plus the property `siteUrl`
- supports read-only or read/write Search Console scopes
- returns the indexed or indexable status of the provided URL
- Google explicitly says the API only provides the status of the version in the Google index; you cannot test a live URL with this method

## Quotas
Google documents URL Inspection quotas:
- per-site: 2,000 QPD and 600 QPM
- per-project: 10,000,000 QPD and 15,000 QPM

## Product implications
### Boundary validation
Before calling Google:
- resolve the property alias
- verify the inspected URL belongs inside the selected property
- reject mismatches early with a structured error

### Caching
Because quotas are much smaller than generic read endpoints, cached inspection results are useful.

### Messaging
Never describe the response as a live fetch.
Prefer language like:
- “indexed view”
- “Google’s indexed state”
- “inspection of Google’s stored/indexed version”

## Sources
- https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
- https://developers.google.com/webmaster-tools/limits
