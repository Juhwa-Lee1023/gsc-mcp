# Repo layout

## Suggested structure
```text
gsc-mcp/
├─ packages/
│  ├─ core/
│  │  ├─ src/
│  │  │  ├─ auth/
│  │  │  ├─ client/
│  │  │  ├─ config/
│  │  │  ├─ normalize/
│  │  │  ├─ planner/
│  │  │  ├─ policy/
│  │  │  ├─ cache/
│  │  │  ├─ audit/
│  │  │  └─ errors/
│  ├─ mcp-server/
│  │  ├─ src/
│  │  │  ├─ tools/
│  │  │  ├─ resources/
│  │  │  ├─ prompts/
│  │  │  └─ server.ts
│  ├─ cli/
│  │  ├─ src/
│  │  │  ├─ commands/
│  │  │  └─ index.ts
│  └─ shared/
│     └─ src/
├─ tests/
├─ docs/
├─ package.json
├─ pnpm-workspace.yaml
└─ tsconfig.base.json
```

## Package responsibilities
### `core`
Business logic and Google API semantics.

### `mcp-server`
Protocol adapter and tool registration.

### `cli`
Operator interface for auth, config, diagnostics, and server launch.

### `shared`
Cross-cutting types or utilities only if they truly need to be shared.

## Rule
Avoid putting real business logic into the MCP tool files themselves.
