# surendranb `google-search-console-mcp`

## Observed strengths
- small and understandable
- friendly to service-account-based automation
- makes property format explicit (`sc-domain:` vs URL-prefix)
- a good example of a narrow wrapper that does not try to become a giant platform

## Observed tradeoffs
- service account setup adds GCP and Search Console permission steps
- less focused on local desktop OAuth convenience
- relatively small surface means fewer higher-level workflow helpers

## What to borrow
- minimalism
- headless / automation orientation
- explicit service account access steps

## What to improve
- stronger planner semantics
- richer accuracy metadata
- better separation between operator commands and model-facing tools

## Sources
- https://github.com/surendranb/google-search-console-mcp
