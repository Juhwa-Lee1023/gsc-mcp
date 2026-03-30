import type { CallToolResult, GetPromptResult, ReadResourceResult, TextContent } from "@modelcontextprotocol/sdk/types.js";

import { toDomainError } from "../domain/errors.js";
import { jsonText } from "../utils/json.js";

export function textContent(text: string): TextContent {
  return {
    type: "text",
    text,
  };
}

export function okToolResult(structuredContent: Record<string, unknown>): CallToolResult {
  return {
    content: [textContent(jsonText(structuredContent))],
    structuredContent,
  };
}

export function errorToolResult(error: unknown): CallToolResult {
  const domainError = toDomainError(error);
  return {
    content: [textContent(jsonText(domainError.toJSON()))],
    structuredContent: domainError.toJSON() as unknown as Record<string, unknown>,
    isError: true,
  };
}

export function jsonResource(uri: string, value: unknown): ReadResourceResult {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: jsonText(value),
      },
    ],
  };
}

export function promptResult(description: string, text: string): GetPromptResult {
  return {
    description,
    messages: [
      {
        role: "user",
        content: textContent(text),
      },
    ],
  };
}
