# Resources and prompts

## Official facts
### Resources
MCP resources are contextual data exposed by URI.

### Prompts
MCP prompts are structured prompt templates that clients can discover and customize with arguments.

## Good use in `gsc-mcp`
### Resources
Use resources for stable state:
- current capability matrix
- active policies
- linked sites
- saved report definitions
- last sync status (later)

### Prompts
Use prompts for repeatable workflows:
- summary report
- compare periods
- debug a URL
- sitemap audit

## Design principle
Put **facts and state** in resources.
Put **workflow guidance** in prompts.
Use **tools** only for actual operations.

## Sources
- https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- https://modelcontextprotocol.io/specification/2025-06-18/server/prompts
