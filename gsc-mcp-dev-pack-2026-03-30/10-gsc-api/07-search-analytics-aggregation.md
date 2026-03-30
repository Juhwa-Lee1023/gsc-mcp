# Aggregation by property vs by page

## Official behavior
Google’s help documentation explains the difference clearly:
- **aggregated by property**: all results for the same query that point to the same property count once
- **aggregated by page**: each unique URL is counted separately

This changes how impressions, clicks, CTR, and position should be interpreted.

## Practical examples
### Property aggregation
If two URLs from the same site appear for the same query, property aggregation counts one property impression.

### Page aggregation
The same situation can count as two page impressions because two distinct URLs appeared.

## Why your server must surface this
Without aggregation metadata, downstream models can make wrong claims about:
- CTR deltas
- position changes
- page totals vs site totals

## Product recommendation
Always return:
- requested aggregation type
- response aggregation type
- explanation if the server had to use `auto`
- a human-readable note in metadata that page and property metrics are not directly interchangeable

## Sources
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://support.google.com/webmasters/answer/7576553?hl=en
- https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data
