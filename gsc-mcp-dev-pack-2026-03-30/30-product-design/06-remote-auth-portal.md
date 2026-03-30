# Future remote auth portal

## Two separate trust relationships
### A. MCP client -> MCP server
This is transport authorization for remote MCP.

### B. MCP server -> Google APIs
This is Google OAuth / Search Console account access.

## Future hosted components
- protected MCP HTTP endpoint
- auth metadata endpoints
- session management
- consent UI
- Google account linking flow
- encrypted token storage
- audit trail

## Important rule
Do not forward MCP client tokens to Google.
The server must obtain and store its own Google-side credentials for each linked user.

## Suggested later milestones
1. implement protected resource metadata
2. implement authorization server discovery / registration support as needed
3. implement consent registry
4. implement Google account linking
5. add per-user property allowlists
