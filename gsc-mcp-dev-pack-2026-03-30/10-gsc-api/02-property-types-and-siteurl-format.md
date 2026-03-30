# Property types and `siteUrl` format

## Official property types
Search Console supports two main property types:
- **URL-prefix** property — includes only URLs with the specified prefix, including the protocol
- **Domain** property — includes all subdomains and multiple protocols for the domain

## API shape
The Search Analytics and Sitemap docs show the same `siteUrl` patterns:
- URL-prefix example: `https://example.com/`
- Domain example: `sc-domain:example.com`

## Why this matters
A lot of implementation pain comes from using the wrong property string. The API expects the exact property identity that Search Console knows.

## Recommended normalization rules
### Alias resolution
Users should mostly reference sites by alias in MCP requests:
- `main`
- `blog`
- `store`

### Canonicalization
Internally:
- preserve `sc-domain:` for domain properties
- normalize URL-prefix properties to an absolute URL with trailing slash
- compare canonicalized values only
- validate that requested inspection URLs are actually inside the selected property boundary

### Do not auto-mutate too aggressively
For safety:
- normalize obvious trailing-slash issues
- but do not silently rewrite across property types

## Sources
- https://support.google.com/webmasters/answer/34592?hl=en
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/webmaster-tools/v1/sitemaps/list
