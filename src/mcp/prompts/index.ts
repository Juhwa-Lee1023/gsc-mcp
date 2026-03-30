import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { promptResult } from "../helpers.js";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "gsc-summary",
    {
      description: "Summarize Search Console performance while explicitly preserving caveats.",
      argsSchema: {
        site: z.string(),
        startDate: z.string(),
        endDate: z.string(),
      },
    },
    async ({ site, startDate, endDate }) =>
      promptResult(
        "Summarize Search Console performance",
        `Use \`gsc.performance.query\` for site \`${site}\` between ${startDate} and ${endDate}. Summarize clicks, impressions, CTR, and position, but always mention \`accuracyClass\`, \`reasons\`, and the resolved PT date range before making claims.`,
      ),
  );

  server.registerPrompt(
    "gsc-compare-periods",
    {
      description: "Compare two Search Console periods for the same site.",
      argsSchema: {
        site: z.string(),
        startDateA: z.string(),
        endDateA: z.string(),
        startDateB: z.string(),
        endDateB: z.string(),
      },
    },
    async ({ site, startDateA, endDateA, startDateB, endDateB }) =>
      promptResult(
        "Compare Search Console periods",
        `Run \`gsc.performance.query\` twice for site \`${site}\`: ${startDateA}..${endDateA} and ${startDateB}..${endDateB}. Compare the periods only after checking each response's \`accuracyClass\`, \`reasons\`, and resolved PT dates.`,
      ),
  );

  server.registerPrompt(
    "gsc-debug-url",
    {
      description: "Debug one URL with indexed-view inspection and nearby performance context.",
      argsSchema: {
        site: z.string(),
        url: z.string(),
        startDate: z.string(),
        endDate: z.string(),
      },
    },
    async ({ site, url, startDate, endDate }) =>
      promptResult(
        "Debug a Search Console URL",
        `Inspect \`${url}\` with \`gsc.url.inspect\` for site \`${site}\`, then query performance for the same property from ${startDate} to ${endDate}. State clearly that URL Inspection reflects Google's indexed view, not a live fetch.`,
      ),
  );

  server.registerPrompt(
    "gsc-sitemap-audit",
    {
      description: "Audit sitemap coverage for one property.",
      argsSchema: {
        site: z.string(),
      },
    },
    async ({ site }) =>
      promptResult(
        "Audit Search Console sitemaps",
        `Use \`gsc.sitemaps.list\` for site \`${site}\`. Highlight pending, warning, and error states, and avoid implying that sitemap presence guarantees indexing.`,
      ),
  );
}
