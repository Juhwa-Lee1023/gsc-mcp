# Env vars and config

## Put in env
- Google OAuth client ID
- Google OAuth client secret
- keychain / encryption secret if needed
- debug flags
- optional cache location overrides

## Put in config file
- property aliases
- allowlists
- write policy
- query planner thresholds
- cache preferences
- future source routing preferences

## Example split
### `.env`
```dotenv
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GSC_MCP_DATA_DIR=.gsc-mcp
```

### `gsc-mcp.config.yaml`
```yaml
google:
  defaultScope: readonly

properties:
  - alias: main
    siteUrl: sc-domain:example.com
    allowRead: true
    allowWrite: false
```

## Rule
Do not hardcode property lists in env vars.
Those belong in config so the policy model stays readable.
