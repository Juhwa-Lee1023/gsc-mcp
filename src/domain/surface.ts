import { areToolsEnabled, listEffectiveEnabledTools } from "./tool-policy.js";
import type { AppConfig, ToolName } from "./types.js";

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

type SurfacePolicyContext = Pick<AppConfig, "toolPolicy" | "writePolicy">;

export function listAvailablePromptNames(context: SurfacePolicyContext): PromptName[] {
  return PROMPT_DEFINITIONS.filter((definition) => areToolsEnabled(context, definition.requiredTools)).map(
    (definition) => definition.name,
  );
}

export function listAvailableResourceUris(context: SurfacePolicyContext): ResourceUri[] {
  return [
    ...STATIC_RESOURCE_URIS,
    ...TOOL_BACKED_RESOURCES.filter((definition) => areToolsEnabled(context, definition.requiredTools)).map(
      (definition) => definition.uri,
    ),
  ];
}

export function buildCapabilitySurface(config: SurfacePolicyContext) {
  const enabledTools = listEffectiveEnabledTools(config);
  const writeTools = enabledTools.filter((toolName) => toolName.startsWith("gsc.sites.") || toolName.startsWith("gsc.sitemaps."));
  const writeToolsEnabledByPolicy = enabledTools.some((toolName) =>
    toolName === "gsc.sites.add" ||
    toolName === "gsc.sites.delete" ||
    toolName === "gsc.sitemaps.submit" ||
    toolName === "gsc.sitemaps.delete",
  );

  return {
    beta: true,
    productPositioning: "read_only_first_inspector",
    liveApiOnly: true,
    writeToolsImplemented: true,
    readOnlyByDefault: true,
    writeToolsEnabledByPolicy,
    writeToolsRequireWriteScope: true,
    exactDetailModeImplemented: false,
    tools: enabledTools,
    resources: listAvailableResourceUris(config),
    prompts: listAvailablePromptNames(config),
    limitedWriteTools: writeTools.filter((toolName) => toolName.includes(".add") || toolName.includes(".delete") || toolName.includes(".submit")),
    notes: [
      "This beta build is a read-only-first Search Console inspector/debugger, not a management suite.",
      "Performance data comes from the live Search Console API only in v1.",
      "Page/query detail results can still be top-row-limited even after shard pagination.",
      "Only the official Search Console API write methods are implemented, and they stay disabled unless writePolicy enables them.",
    ],
  };
}
