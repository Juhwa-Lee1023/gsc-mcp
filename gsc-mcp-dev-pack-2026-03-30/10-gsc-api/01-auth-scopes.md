# Auth and scopes

## Official facts
- Every Search Console API request must include an authorization token.
- Google requires **OAuth 2.0** for Search Console API access; no other authorization protocol is supported.
- The two key scopes are:
  - `https://www.googleapis.com/auth/webmasters` — read/write
  - `https://www.googleapis.com/auth/webmasters.readonly` — read-only

## Practical implications
### Local-first mode
For local `stdio` MCP, a typical pattern is:
1. create OAuth client credentials in Google Cloud
2. run a local browser login
3. capture a refresh token
4. store the refresh token securely
5. refresh access tokens when needed

### Future hosted mode
For remote HTTP mode, Search Console still requires Google OAuth on the server side. MCP transport auth is a separate layer and must not be confused with Google API auth.

## Recommended policy for this project
- Default to `webmasters.readonly`.
- Make write scope an explicit upgrade path.
- Store only the minimum necessary tokens.
- Keep write tools off unless both scope and server policy allow them.

## Sources
- https://developers.google.com/webmaster-tools/v1/how-tos/authorizing
- https://developers.google.com/webmaster-tools/about
