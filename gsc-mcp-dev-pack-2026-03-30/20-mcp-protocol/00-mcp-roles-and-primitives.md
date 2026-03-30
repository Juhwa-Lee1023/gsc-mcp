# MCP roles and primitives

## Official overview
The MCP specification describes:
- **Hosts** — LLM applications that initiate connections
- **Clients** — connectors inside the host application
- **Servers** — services that provide context and capabilities

The protocol uses JSON-RPC 2.0 messages.

## Main server primitives
### Tools
For invoking actions or computations.

### Resources
For exposing contextual data identified by URIs.

### Prompts
For exposing structured prompt templates.

## Why this matters to `gsc-mcp`
A good implementation should use all three thoughtfully:
- **tools** for live Search Console operations
- **resources** for capabilities, policies, and saved views
- **prompts** for reusable GSC workflows

## Sources
- https://modelcontextprotocol.io/specification/2025-11-25
- https://modelcontextprotocol.io/docs/learn/architecture
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- https://modelcontextprotocol.io/specification/2025-06-18/server/prompts
