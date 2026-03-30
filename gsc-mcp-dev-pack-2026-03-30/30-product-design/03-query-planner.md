# Query planner

## Why a planner is necessary
Search Console queries differ dramatically in cost and completeness depending on:
- date range
- whether page/query dimensions are used
- whether filters use page/query
- whether recent/incomplete data is requested

A thin pass-through wrapper will either be slow, misleading, or both.

## Recommended planner inputs
- site
- date range
- type
- dimensions
- filters
- aggregation type
- data state
- fidelity mode (`best_effort` vs `prefer_exact`)
- source preference (`auto`, `live_api`, `mirror`, `bulk_export`)

## Recommended planner outputs
- execution plan
- split strategy
- expected cost class
- expected accuracy class
- normalized Google API requests

## Suggested cost classes
- `low`
- `medium`
- `high`
- `critical`

## Suggested heuristics
### Summary queries
- no page/query dimensions
- can span longer windows
- usually stay on live API

### Detail queries
- page or query involved
- shorter windows
- split more aggressively
- may return only top rows
- historical exactness should eventually route to bulk export or mirror data

## Refusal / downgrade policy
If the caller asks for exact, high-cardinality, long-range detail without bulk export support:
- either split aggressively and mark as best effort
- or return a structured error explaining the limitation
