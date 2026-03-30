# Test plan

## Unit tests
- URL-prefix normalization
- domain property normalization
- alias resolution
- URL-inspection boundary checks
- planner cost classification
- planner range splitting
- accuracyClass assignment
- error mapping

## Integration-style tests
Use mocked Google responses to test:
- sites list flow
- performance query flow
- search appearance helper flow
- sitemap list/get flow
- URL inspection flow

## Protocol tests
- stdio boot
- initialize handshake
- tool registration list
- stdout cleanliness
- stderr logging behavior

## Config tests
- valid config parse
- invalid alias duplication
- invalid siteUrl formats
- disabled write tools
- readonly default

## Golden fixtures
Keep sample Google responses as fixtures so normalization logic remains stable over time.
