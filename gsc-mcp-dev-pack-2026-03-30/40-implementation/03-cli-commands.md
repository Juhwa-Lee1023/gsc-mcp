# CLI commands

## Core commands
```bash
gsc-mcp init
gsc-mcp auth login --scope readonly
gsc-mcp auth upgrade --scope write
gsc-mcp auth status
gsc-mcp serve stdio
gsc-mcp config show
gsc-mcp sites list
gsc-mcp doctor
```

## Nice-to-have later
```bash
gsc-mcp sync probe --site main
gsc-mcp sync backfill --site main --from 2025-01-01 --to 2025-12-31
gsc-mcp sync reconcile --site main --days 30
```

## Why the CLI matters
The CLI is not only for humans.
It also makes the core package easier to test and debug independently of any MCP client.
