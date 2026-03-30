# saurabhsharma2u `search-console-mcp`

## Observed strengths
- very mature operator experience relative to the other projects reviewed
- broad tool surface across GSC, Bing, and GA4
- desktop auth flow with strong token storage messaging
- multi-account support
- release history and explicit security posture

## Observed tradeoffs
- much broader than a GSC-only MCP
- the wide tool surface can be powerful but also heavier for focused workflows
- bundling GSC with Bing and GA4 changes the product identity from “adapter” to “analytics platform”

## What to borrow
- strong credential handling ideas
- multi-account thinking
- operator-first CLI ergonomics

## What to avoid
- broad scope in v1
- cross-platform intelligence features before the GSC core is rock-solid

## Sources
- https://github.com/saurabhsharma2u/search-console-mcp
