# MCP authorization

## Official facts
The MCP auth spec says:
- authorization is optional in general
- HTTP-based transports should conform to the auth spec
- `stdio` implementations should not use the transport auth spec and instead retrieve credentials from the environment
- MCP clients must use OAuth resource indicators (`resource` parameter) for the target MCP server
- MCP servers must only accept tokens intended for themselves
- MCP servers must not pass through client tokens to downstream APIs

## Key design consequence
There are two separate auth layers in a remote GSC server:
1. **MCP client -> MCP server** auth
2. **MCP server -> Google Search Console API** auth

They are not interchangeable.

## Recommendation
In v1:
- avoid remote auth entirely

In future remote mode:
- issue or accept tokens for the MCP server itself
- store Google refresh tokens server-side
- mint server-side Google access tokens when calling Google APIs
- never forward MCP client tokens to Google APIs

## Sources
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- https://modelcontextprotocol.io/docs/tutorials/security/authorization
