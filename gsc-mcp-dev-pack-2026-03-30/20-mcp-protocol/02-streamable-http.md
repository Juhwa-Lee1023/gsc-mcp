# Streamable HTTP

## Official transport facts
Current MCP transport docs say:
- Streamable HTTP replaces the older HTTP+SSE transport from 2024-11-05
- the server provides a single MCP endpoint supporting POST and GET
- POST carries JSON-RPC messages
- responses can be plain JSON or SSE streams
- servers may assign an `MCP-Session-Id`
- clients must return that session header on later requests

## Security requirements
The transport page explicitly says:
- validate the `Origin` header
- return HTTP 403 for invalid origins
- bind only to localhost when running locally
- implement proper authentication

## Implication for this project
Do not start with Streamable HTTP, but do design for it:
- keep transport adapters separate from core GSC logic
- make session handling an interface, not business logic
- keep HTTP auth separate from Google API auth

## Sources
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
