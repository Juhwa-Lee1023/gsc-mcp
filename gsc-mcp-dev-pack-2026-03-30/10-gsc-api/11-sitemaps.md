# Sitemaps

## Official facts
The Sitemaps resource supports:
- `list`
- `get`
- `submit`
- `delete`

Read methods accept read-only or read/write access.
Write methods require the full write scope.

The list method can include sitemaps submitted for the site and those included in a sitemap index file.

## Why sitemaps matter in this project
If this server ever enables writes, sitemap submission is the safest starting point because:
- it is an official Search Console write surface
- it is narrower than generic indexing requests
- it aligns with standard site maintenance

## Product recommendation
### v1
Ship read methods by default:
- `gsc.sitemaps.list`
- `gsc.sitemaps.get`

### optional later
Gate these behind flags + write scope:
- `gsc.sitemaps.submit`
- `gsc.sitemaps.delete`

## Sources
- https://developers.google.com/webmaster-tools/v1/sitemaps
- https://developers.google.com/webmaster-tools/v1/sitemaps/list
- https://developers.google.com/webmaster-tools/v1/sitemaps/get
- https://developers.google.com/webmaster-tools/v1/sitemaps/submit
- https://developers.google.com/webmaster-tools/v1/sitemaps/delete
