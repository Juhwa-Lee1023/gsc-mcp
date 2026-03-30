# TypeScript stack

## Recommended stack
- Node 20+
- TypeScript
- pnpm (or npm if necessary)
- Zod for runtime validation
- a thin fetch-based Google client wrapper
- SQLite for local cache / metadata
- OS keychain integration if possible

## Why TypeScript
- clear contracts for tool input/output
- good fit for MCP ecosystem tooling
- easy schema reuse between CLI, core, and MCP layers

## Validation
Use Zod to define:
- config schemas
- tool input schemas
- normalized output schemas
- environment variable parsing

## Testing
Use:
- Vitest or Jest
- mock fetch / nock / MSW style HTTP mocking
- fixture-based Google response normalization tests
