import { createDomainError } from "./errors.js";
import {
  DESTRUCTIVE_WRITE_TOOLS,
  IMPLEMENTED_TOOLS,
  WRITE_TOOLS,
  type AppConfig,
  type ToolName,
  type ToolPolicy,
  type WriteToolName,
  type WritePolicy,
} from "./types.js";

const IMPLEMENTED_TOOL_SET = new Set<ToolName>(IMPLEMENTED_TOOLS);
const WRITE_TOOL_SET = new Set<WriteToolName>(WRITE_TOOLS);
const DESTRUCTIVE_WRITE_TOOL_SET = new Set<WriteToolName>(DESTRUCTIVE_WRITE_TOOLS);

type PolicyContext = Pick<AppConfig, "toolPolicy" | "writePolicy">;

export function isImplementedTool(toolName: string): toolName is ToolName {
  return IMPLEMENTED_TOOL_SET.has(toolName as ToolName);
}

export function isWriteTool(toolName: string): toolName is WriteToolName {
  return WRITE_TOOL_SET.has(toolName as WriteToolName);
}

export function isToolEnabled(toolPolicy: ToolPolicy, toolName: ToolName): boolean {
  return toolPolicy.enabledTools.includes(toolName) && !toolPolicy.disabledTools.includes(toolName);
}

export function isWriteToolAvailable(writePolicy: WritePolicy, toolName: WriteToolName): boolean {
  return writePolicy.enabled && writePolicy.allowedTools.includes(toolName);
}

export function isToolAvailable(context: PolicyContext, toolName: ToolName): boolean {
  if (!isToolEnabled(context.toolPolicy, toolName)) {
    return false;
  }
  if (!isWriteTool(toolName)) {
    return true;
  }
  return isWriteToolAvailable(context.writePolicy, toolName);
}

export function listEffectiveEnabledTools(context: PolicyContext): ToolName[] {
  return IMPLEMENTED_TOOLS.filter((toolName) => isToolAvailable(context, toolName));
}

export function assertToolEnabled(toolPolicy: ToolPolicy, toolName: ToolName): void {
  if (!isToolEnabled(toolPolicy, toolName)) {
    throw createDomainError("TOOL_DISABLED", `Tool ${toolName} is disabled by the current tool policy.`);
  }
}

export function assertToolAvailable(context: PolicyContext, toolName: ToolName): void {
  if (isWriteTool(toolName)) {
    if (!isToolEnabled(context.toolPolicy, toolName) || !isWriteToolAvailable(context.writePolicy, toolName)) {
      throw createDomainError(
        "WRITE_TOOL_DISABLED",
        `Tool ${toolName} is disabled until writePolicy enables it and toolPolicy exposes it.`,
      );
    }
    return;
  }
  assertToolEnabled(context.toolPolicy, toolName);
}

export function areToolsEnabled(context: PolicyContext, toolNames: readonly ToolName[]): boolean {
  return toolNames.every((toolName) => isToolAvailable(context, toolName));
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

export function validateWritePolicy(context: PolicyContext): void {
  const { toolPolicy, writePolicy } = context;
  const seenAllowed = new Set<WriteToolName>();

  for (const toolName of writePolicy.allowedTools) {
    if (!isWriteTool(toolName)) {
      throw createDomainError("CONFIG_ERROR", `Write policy references an unsupported write tool: ${toolName}`);
    }
    if (seenAllowed.has(toolName)) {
      throw createDomainError("CONFIG_ERROR", `Write policy allows the same tool more than once: ${toolName}`);
    }
    seenAllowed.add(toolName);
  }

  if (!writePolicy.enabled) {
    return;
  }

  for (const toolName of writePolicy.allowedTools) {
    if (!toolPolicy.enabledTools.includes(toolName) || toolPolicy.disabledTools.includes(toolName)) {
      throw createDomainError(
        "CONFIG_ERROR",
        `Write policy allows ${toolName}, but toolPolicy does not expose it as an enabled tool.`,
      );
    }
  }

  const destructiveEnabled = writePolicy.allowedTools.some((toolName) => DESTRUCTIVE_WRITE_TOOL_SET.has(toolName));
  if (destructiveEnabled && !writePolicy.requireConfirmationForDestructive) {
    throw createDomainError(
      "CONFIG_ERROR",
      "requireConfirmationForDestructive must stay true when destructive write tools are enabled in this beta.",
    );
  }

  if (
    writePolicy.allowedTools.includes("gsc.sites.add") &&
    writePolicy.siteAddAllowlist.length === 0 &&
    writePolicy.siteAddAllowPatterns.length === 0
  ) {
    throw createDomainError(
      "CONFIG_ERROR",
      "writePolicy must define siteAddAllowlist or siteAddAllowPatterns before enabling gsc.sites.add.",
    );
  }

  if (
    writePolicy.allowedTools.includes("gsc.sites.delete") &&
    writePolicy.siteDeleteAllowlist.length === 0 &&
    writePolicy.siteDeleteAllowPatterns.length === 0
  ) {
    throw createDomainError(
      "CONFIG_ERROR",
      "writePolicy must define siteDeleteAllowlist or siteDeleteAllowPatterns before enabling gsc.sites.delete.",
    );
  }
}
