# Search appearance two-step flow

## Official facts
Google’s “all your data” guide says search appearance cannot be returned alongside arbitrary other dimensions directly in the same way as regular breakdowns.

Recommended process:
1. query with `dimensions: ["searchAppearance"]` only
2. take one returned appearance type
3. run a second query filtered by that appearance type
4. add desired dimensions like page, country, query, or device

Google says you must repeat step 2 once per appearance type you care about.

## Product recommendation
Do **not** expose this awkwardness directly to the user if you can avoid it.

Implement:
- `gsc.performance.search_appearance.list` — first-step helper
- standard `gsc.performance.query` with a filter on `searchAppearance`

That keeps the protocol small while making the workflow much easier for agent planning.

## Sources
- https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data
