# V1 goals and non-goals

## Goals
### 1. Local-first transport
Support `stdio` first. MCP guidance explicitly treats `stdio` as the natural fit for local servers, while HTTP auth rules target remote servers.

### 2. Read-only by default
Use `webmasters.readonly` by default and keep write scope optional.

### 3. GSC-only
Focus only on:
- Sites
- Search Analytics
- Sitemaps
- URL Inspection

### 4. Small tool surface
A small set of predictable tools is better for planning and safety.

### 5. Honest response metadata
Every analytics response should declare how trustworthy or incomplete the response may be.

### 6. Future-ready architecture
Prepare interfaces for:
- a sync worker
- a mirror store
- optional remote HTTP mode
- optional write-tool confirmation tokens

## Non-goals
- GA4 integration
- Bing integration
- PageSpeed correlation
- broad SEO diagnostics
- automatic ranking advice engine
- background crawling
- generic indexing submission
- multi-tenant hosted OAuth in the first implementation
- huge prompt library before core tools are correct

## Design rule of thumb
If a feature makes the product feel like a broad SEO suite rather than a GSC adapter, it probably belongs outside v1.

## Sources
- https://developers.google.com/webmaster-tools/v1/api_reference_index
- https://developers.google.com/webmaster-tools/v1/how-tos/authorizing
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://modelcontextprotocol.io/docs/tutorials/security/authorization
- https://github.com/saurabhsharma2u/search-console-mcp
