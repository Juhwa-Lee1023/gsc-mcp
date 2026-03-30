# Tool surface v1

## Read-only tools
- `gsc.sites.list`
- `gsc.sites.get`
- `gsc.performance.query`
- `gsc.performance.search_appearance.list`
- `gsc.url.inspect`
- `gsc.sitemaps.list`
- `gsc.sitemaps.get`

## Resources
- `gsc://capabilities`
- `gsc://policies/current`
- `gsc://sites`
- `gsc://site/{site}/sitemaps`

## Prompts
- `gsc-summary`
- `gsc-compare-periods`
- `gsc-debug-url`
- `gsc-sitemap-audit`

## Disabled-by-default write tools
- `gsc.sitemaps.submit`
- `gsc.sitemaps.delete`
- `gsc.sites.add`
- `gsc.sites.delete`

## Excluded from v1
- generic indexing submission
- GA4/Bing/PageSpeed blend tools
- long-running background jobs exposed as model-callable tools
