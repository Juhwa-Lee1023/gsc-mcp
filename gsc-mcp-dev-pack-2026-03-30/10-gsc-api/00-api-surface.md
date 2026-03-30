# Search Console API surface

## Official scope
The Search Console API provides programmatic access to much of Search Console, specifically:
- Sites
- Search Analytics
- Sitemaps
- URL Inspection

The API is exposed as REST and can also be used through Google client libraries.

## Why this matters to `gsc-mcp`
The first version of this project should map almost one-to-one to the official API surface:
- `sites.*`
- `performance.*`
- `sitemaps.*`
- `url.inspect`

That is enough to cover the core operational workflows for most agent use cases.

## Recommended mapping
| Google API area | MCP family |
|---|---|
| Sites | `gsc.sites.*` |
| Search Analytics | `gsc.performance.*` |
| Sitemaps | `gsc.sitemaps.*` |
| URL Inspection | `gsc.url.inspect` |

## What not to assume
The API does **not** mean every Search Console UI feature is available or equally mature through the API. You should keep the implementation honest about what is directly supported.

## Sources
- https://developers.google.com/webmaster-tools/about
- https://developers.google.com/webmaster-tools/v1/api_reference_index
