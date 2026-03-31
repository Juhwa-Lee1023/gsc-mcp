import { createDomainError } from "./errors.js";
import { READ_ONLY_TOOLS, type ToolName, type ToolPolicy } from "./types.js";

const IMPLEMENTED_TOOL_SET = new Set<ToolName>(READ_ONLY_TOOLS);

export function isImplementedTool(toolName: string): toolName is ToolName {
  return IMPLEMENTED_TOOL_SET.has(toolName as ToolName);
}

export function isToolEnabled(toolPolicy: ToolPolicy, toolName: ToolName): boolean {
  return toolPolicy.enabledTools.includes(toolName) && !toolPolicy.disabledTools.includes(toolName);
}

export function listEffectiveEnabledTools(toolPolicy: ToolPolicy): ToolName[] {
  return READ_ONLY_TOOLS.filter((toolName) => isToolEnabled(toolPolicy, toolName));
}

export function assertToolEnabled(toolPolicy: ToolPolicy, toolName: ToolName): void {
  if (!isToolEnabled(toolPolicy, toolName)) {
    throw createDomainError("TOOL_DISABLED", `Tool ${toolName} is disabled by the current tool policy.`);
  }
}

export function areToolsEnabled(toolPolicy: ToolPolicy, toolNames: readonly ToolName[]): boolean {
  return toolNames.every((toolName) => isToolEnabled(toolPolicy, toolName));
}

export function validateToolPolicy(toolPolicy: ToolPolicy): void {
  const seenEnabled = new Set<ToolName>();
  for (const toolName of toolPolicy.enabledTools) {
    if (!isImplementedTool(toolName)) {
      throw createDomainError("CONFIG_ERROR", `Tool policy enables an unimplemented tool: ${toolName}`);
    }
    if (seenEnabled.has(toolName)) {
      throw createDomainError("CONFIG_ERROR", `Tool policy enables the same tool more than once: ${toolName}`);
    }
    seenEnabled.add(toolName);
  }

  const seenDisabled = new Set<ToolName>();
  for (const toolName of toolPolicy.disabledTools) {
    if (!isImplementedTool(toolName)) {
      throw createDomainError("CONFIG_ERROR", `Tool policy disables an unimplemented tool: ${toolName}`);
    }
    if (seenDisabled.has(toolName)) {
      throw createDomainError("CONFIG_ERROR", `Tool policy disables the same tool more than once: ${toolName}`);
    }
    if (seenEnabled.has(toolName)) {
      throw createDomainError("CONFIG_ERROR", `Tool policy cannot both enable and disable ${toolName}.`);
    }
    seenDisabled.add(toolName);
  }
}
