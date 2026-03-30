# Sites resource

## Official facts
The Sites resource supports:
- `list`
- `get`
- `add`
- `delete`

Site entries include:
- `siteUrl`
- `permissionLevel`

Documented permission levels include:
- `siteOwner`
- `siteFullUser`
- `siteRestrictedUser`
- `siteUnverifiedUser`

## Design implications
### Expose permission levels directly
The MCP server should return Google’s own permission level rather than collapsing everything to a custom role.

### Use allowlists on top
Even if Google says the user can access 50 properties, the MCP server should expose only the subset explicitly allowed by local config.

### Write operations
`sites.add` and `sites.delete` exist officially, but they should be optional and off by default in this project.

## Suggested MCP responses
For `gsc.sites.list`, return:
- alias
- canonical siteUrl
- permissionLevel
- readEnabled
- writeEnabled

For `gsc.sites.get`, return:
- same fields plus any config or policy view that helps the caller understand the boundary

## Sources
- https://developers.google.com/webmaster-tools/v1/sites
- https://developers.google.com/webmaster-tools/v1/sites/list
- https://developers.google.com/webmaster-tools/v1/sites/add
- https://developers.google.com/webmaster-tools/v1/sites/delete
