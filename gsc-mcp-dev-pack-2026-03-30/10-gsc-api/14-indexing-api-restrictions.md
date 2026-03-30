# Why generic indexing should stay out of v1

## Official facts
Google’s Indexing API docs are explicit:
- the API is intended for **JobPosting** pages and **BroadcastEvent embedded in a VideoObject** pages
- Google recommends it for short-lived pages like job postings or livestream videos
- abuse or quota circumvention can result in access being revoked
- default onboarding quota is limited and additional approval is needed

## Why this matters
Some community GSC MCP servers expose a generic “request indexing” tool. That creates product confusion:
- users may think it is for arbitrary blog posts or product pages
- it is easy for an agent to misuse
- it expands the safety surface significantly

## Recommendation for this project
Do not include generic indexing submission in v1.

If you ever add it later:
- ship it as a separate addon
- validate supported schema types
- require explicit enablement
- require confirmation
- log every invocation carefully

## Sources
- https://developers.google.com/search/apis/indexing-api/v3/quickstart
- https://developers.google.com/search/apis/indexing-api/v3/using-api
- https://developers.google.com/search/apis/indexing-api/v3/quota-pricing
