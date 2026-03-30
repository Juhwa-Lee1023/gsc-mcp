import type { ToolName, ToolPolicy } from "./types.js";

export function isToolEnabled(toolPolicy: ToolPolicy, toolName: ToolName): boolean {
  return toolPolicy.enabledTools.includes(toolName) && !toolPolicy.disabledTools.includes(toolName);
}

export function listEffectiveEnabledTools(toolPolicy: ToolPolicy): ToolName[] {
  return toolPolicy.enabledTools.filter((toolName) => !toolPolicy.disabledTools.includes(toolName));
}
