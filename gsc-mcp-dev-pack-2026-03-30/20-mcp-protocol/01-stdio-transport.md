# STDIO transport

## Official transport facts
The 2025-11-25 MCP transports page says:
- the client launches the server as a subprocess
- the server reads JSON-RPC messages from `stdin`
- the server writes JSON-RPC messages to `stdout`
- messages are newline-delimited JSON-RPC
- the server may log to `stderr`
- the server must not write anything to `stdout` that is not a valid MCP message

## Why this should be v1
STDIO is ideal for local, single-user usage:
- smaller security surface
- no remote auth complexity
- easier to reason about while the core Search Console semantics are still being built

## Implementation checklist
- keep protocol output isolated on stdout
- send logs and diagnostics to stderr only
- never print ad hoc banners or console noise on stdout
- test boot, initialize, and tool invocation with a real local MCP client

## Sources
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
