import { areToolsEnabled, listEffectiveEnabledTools } from "./tool-policy.js";
import type { ToolName, ToolPolicy } from "./types.js";

export const STATIC_RESOURCE_URIS = ["gsc://capabilities", "gsc://policies/current"] as const;

export const TOOL_BACKED_RESOURCES = [
  {
    uri: "gsc://sites",
    requiredTools: ["gsc.sites.list"] as const satisfies readonly ToolName[],
  },
  {
    uri: "gsc://site/{site}/sitemaps",
    requiredTools: ["gsc.sitemaps.list"] as const satisfies readonly ToolName[],
  },
] as const;

export const PROMPT_DEFINITIONS = [
  {
    name: "gsc-summary",
    requiredTools: ["gsc.performance.query"] as const satisfies readonly ToolName[],
  },
  {
    name: "gsc-compare-periods",
    requiredTools: ["gsc.performance.query"] as const satisfies readonly ToolName[],
  },
  {
    name: "gsc-debug-url",
    requiredTools: ["gsc.url.inspect", "gsc.performance.query"] as const satisfies readonly ToolName[],
  },
  {
    name: "gsc-sitemap-audit",
    requiredTools: ["gsc.sitemaps.list"] as const satisfies readonly ToolName[],
  },
] as const;

export type PromptName = (typeof PROMPT_DEFINITIONS)[number]["name"];
export type StaticResourceUri = (typeof STATIC_RESOURCE_URIS)[number];
export type ToolBackedResourceUri = (typeof TOOL_BACKED_RESOURCES)[number]["uri"];
export type ResourceUri = StaticResourceUri | ToolBackedResourceUri;

export function listAvailablePromptNames(toolPolicy: ToolPolicy): PromptName[] {
  return PROMPT_DEFINITIONS.filter((definition) => areToolsEnabled(toolPolicy, definition.requiredTools)).map(
    (definition) => definition.name,
  );
}

export function listAvailableResourceUris(toolPolicy: ToolPolicy): ResourceUri[] {
  return [
    ...STATIC_RESOURCE_URIS,
    ...TOOL_BACKED_RESOURCES.filter((definition) => areToolsEnabled(toolPolicy, definition.requiredTools)).map(
      (definition) => definition.uri,
    ),
  ];
}

export function buildCapabilitySurface(toolPolicy: ToolPolicy) {
  return {
    beta: true,
    productPositioning: "read_only_inspector",
    liveApiOnly: true,
    writeToolsImplemented: false,
    exactDetailModeImplemented: false,
    tools: listEffectiveEnabledTools(toolPolicy),
    resources: listAvailableResourceUris(toolPolicy),
    prompts: listAvailablePromptNames(toolPolicy),
    notes: [
      "This beta build is a read-only Search Console inspector/debugger, not a management suite.",
      "Performance data comes from the live Search Console API only in v1.",
      "Page/query detail results can still be top-row-limited even after shard pagination.",
    ],
  };
}
