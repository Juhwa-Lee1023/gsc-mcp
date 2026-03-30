# Security threat model

## Official MCP security themes
The MCP security guidance emphasizes several risks that matter for a future hosted GSC server:
- confused deputy attacks
- token passthrough
- SSRF during OAuth metadata or auth discovery
- bad redirect URI handling
- weak consent handling
- insecure localhost exposure

## Important security rules called out by MCP docs
- MCP proxy servers need per-client consent storage
- redirect URIs should be checked with exact matching
- OAuth `state` should be random, single-use, and validated strictly
- token passthrough is forbidden
- production OAuth URLs should be HTTPS
- local servers should prefer `stdio` or otherwise restrict HTTP access

## Consequence for this project
### v1
- use `stdio`
- local token storage only
- no remote transport auth

### future remote mode
- separate MCP auth from Google auth
- server-side consent registry
- exact redirect URI validation
- secure cookies or server-side sessions
- token audience validation
- no token passthrough

## Sources
- https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
