import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createMcpServer } from "../../src/mcp/server.js";
import { createTestContext } from "../helpers.js";

describe("mcp server", () => {
  it("registers tools, resources, and prompts", async () => {
    const context = createTestContext();
    const server = createMcpServer(context);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const resources = await client.listResources();
    const prompts = await client.listPrompts();

    expect(tools.tools.some((tool) => tool.name === "gsc.performance.query")).toBe(true);
    expect(resources.resources.some((resource) => resource.uri === "gsc://capabilities")).toBe(true);
    expect(prompts.prompts.some((prompt) => prompt.name === "gsc-summary")).toBe(true);
  });

  it("keeps static resources readable without auth", async () => {
    const context = createTestContext();
    const server = createMcpServer(context);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const resource = await client.readResource({ uri: "gsc://capabilities" });
    const firstContent = resource.contents[0];
    expect(firstContent).toBeDefined();
    expect(firstContent && "text" in firstContent).toBe(true);
    if (!firstContent || !("text" in firstContent)) {
      throw new Error("Expected text resource content.");
    }
    expect(firstContent.text).toContain("\"transport\": \"stdio\"");
  });
});
