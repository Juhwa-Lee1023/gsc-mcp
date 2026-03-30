# Core interfaces and Zod schemas

## Core config schema
```ts
type AppConfig = {
  google: {
    defaultScope: "readonly" | "write";
  };
  properties: Array<{
    alias: string;
    siteUrl: string;
    allowRead: boolean;
    allowWrite: boolean;
  }>;
  queryPolicy: {
    defaultDataState: "final" | "all" | "hourly_all";
    maxInteractiveDays: { summary: number; detail: number };
    splitDailyAfterDays: { detail: number };
    blockExactWithPageOrQueryWithoutBulkExport: boolean;
  };
};
```

## Planner input
```ts
type PerformanceQueryIntent = {
  site: string;
  startDate: string;
  endDate: string;
  type?: "web" | "image" | "video" | "news" | "discover" | "googleNews";
  dimensions?: string[];
  filters?: Array<{ dimension: string; operator: string; expression: string }>;
  aggregationType?: "auto" | "byPage" | "byProperty";
  dataState?: "final" | "all" | "hourly_all";
  fidelity?: "best_effort" | "prefer_exact";
  sourcePreference?: "auto" | "live_api" | "mirror" | "bulk_export";
  pageSize?: number;
  cursor?: string | null;
};
```

## Planner output
- normalized Google request(s)
- cost class
- expected accuracy class
- split plan
- source choice

## Key design note
The planner output should be rich enough that both the CLI and the MCP server can explain what they are doing.
