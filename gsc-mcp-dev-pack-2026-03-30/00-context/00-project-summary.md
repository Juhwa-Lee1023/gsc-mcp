# Project summary

## Problem
Existing community Google Search Console MCP servers are useful, but most fall into one of two buckets:
- lightweight wrappers that are easy to start but under-specified for production use
- large “SEO platforms” that combine many systems and become heavy quickly

This project aims to occupy the middle ground: **small, reliable, GSC-only infrastructure for agent workflows**.

## Product thesis
Build a server that:
- respects Search Console’s data model and caveats
- gives models tools that are easy to plan around
- does not over-promise completeness when Google itself returns truncated or privacy-filtered data
- keeps write actions rare, explicit, and heavily gated
- starts local and read-only first

## Why this matters
Search Console data looks simple on the surface, but several facts make a naive wrapper risky:
- Search Analytics requests can be truncated or top-row only.
- query/page detail requests are computationally expensive and more likely to lose data.
- anonymized queries create differences between totals and listed rows.
- recent data can be incomplete.
- URL Inspection is about Google’s indexed view, not a live crawl.
- the Indexing API is only intended for JobPosting and livestream `BroadcastEvent` pages, not general webpages.

## Sharp product statement
**`gsc-mcp` should be a dependable GSC adapter for agents, not a generic SEO super-app.**

## Sources
- https://developers.google.com/webmaster-tools/about
- https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
- https://developers.google.com/search/apis/indexing-api/v3/quickstart
- https://developers.google.com/search/blog/2022/10/performance-data-deep-dive
