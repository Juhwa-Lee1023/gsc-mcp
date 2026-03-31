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

  it("keeps capabilities aligned with actual policy-filtered surface", async () => {
    const context = createTestContext();
    context.config.toolPolicy.disabledTools.push("gsc.sites.list", "gsc.performance.query");
    const server = createMcpServer(context);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const resources = await client.listResources();
    const prompts = await client.listPrompts();
    const capabilities = await client.readResource({ uri: "gsc://capabilities" });
    const firstContent = capabilities.contents[0];

    expect(tools.tools.some((tool) => tool.name === "gsc.sites.list")).toBe(false);
    expect(resources.resources.some((resource) => resource.uri === "gsc://sites")).toBe(false);
    expect(prompts.prompts.some((prompt) => prompt.name === "gsc-summary")).toBe(false);

    if (!firstContent || !("text" in firstContent)) {
      throw new Error("Expected capabilities text resource.");
    }

    const parsed = JSON.parse(firstContent.text);
    expect(parsed.tools).not.toContain("gsc.sites.list");
    expect(parsed.resources).not.toContain("gsc://sites");
    expect(parsed.prompts).not.toContain("gsc-summary");
  });

  it("rejects unsupported sourcePreference values over MCP", async () => {
    const context = createTestContext();
    const server = createMcpServer(context);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: "gsc.performance.query",
      arguments: {
        site: "main",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        sourcePreference: "mirror",
      },
    });

    expect(result.isError).toBe(true);
    const content = Array.isArray(result.content) ? result.content : [];
    const firstContent = content[0];
    if (!firstContent || !("text" in firstContent)) {
      throw new Error("Expected text tool result.");
    }
    expect(firstContent.text).toContain("live_api");
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

  it("does not register tools disabled by policy", async () => {
    const context = createTestContext();
    context.config.toolPolicy.disabledTools.push("gsc.performance.query");
    const server = createMcpServer(context);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools();
    expect(tools.tools.some((tool) => tool.name === "gsc.performance.query")).toBe(false);
  });
});
