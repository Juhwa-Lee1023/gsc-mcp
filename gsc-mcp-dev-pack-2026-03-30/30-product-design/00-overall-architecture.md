# Overall architecture

## Design target
Use a layered architecture:

1. **core**
   - auth bootstrap
   - Search Console client
   - site normalization
   - policy engine
   - query planner
   - error mapping
   - cache interfaces
   - audit interfaces

2. **mcp-server**
   - tool/resource/prompt registration
   - transport adapter (`stdio` first)
   - request validation
   - response formatting

3. **cli**
   - auth commands
   - config inspection
   - local diagnostics
   - server launch helper

4. **future sync worker**
   - daily probe
   - finalized sync
   - reconciliation
   - mirror store

5. **future remote auth portal**
   - MCP HTTP auth
   - Google account linking
   - session handling
   - consent UI

## Why this split works
- transport concerns do not pollute GSC logic
- a CLI can reuse the same core client
- sync and remote concerns can be added later without rewriting the core
- tests become easier because the planner and normalizers are decoupled

## Key principle
The core package should know almost nothing about MCP transport details.
