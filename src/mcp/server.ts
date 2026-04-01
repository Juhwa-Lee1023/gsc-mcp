import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import type { RuntimeContext } from "../domain/types.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";

export function createMcpServer(context: RuntimeContext): McpServer {
  const server = new McpServer({
    name: "gsc-mcp",
    version: "0.1.0-beta.1",
  });
  registerTools(server, context);
  registerResources(server, context);
  registerPrompts(server, context);
  return server;
}

export async function serveStdio(context: RuntimeContext): Promise<void> {
  const server = createMcpServer(context);
  const transport = new StdioServerTransport(process.stdin, process.stdout);
  await server.connect(transport);
}
