import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProjectraMcpServer } from "../src/server.js";
import type { AgentOperation, JsonValue, ProjectraGateway } from "../src/types.js";

const closeCallbacks: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(closeCallbacks.splice(0).map((close) => close()));
});

async function connectedClient(gateway: ProjectraGateway) {
  const server = createProjectraMcpServer(gateway);
  const client = new Client({ name: "projectra-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  closeCallbacks.push(async () => { await client.close(); await server.close(); });
  return client;
}

function mockGateway(mock: ReturnType<typeof vi.fn>): ProjectraGateway {
  return {
    async call<T extends JsonValue>(operation: AgentOperation, input?: Record<string, JsonValue>, signal?: AbortSignal) {
      return await mock(operation, input, signal) as T;
    },
  };
}

describe("ProjectRA MCP server", () => {
  it("exposes the scoped task tools and no destructive/admin tools", async () => {
    const client = await connectedClient(mockGateway(vi.fn(async () => ({} as JsonValue))));
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining([
      "list_projects", "get_task", "create_task", "update_task",
      "assign_task", "add_task_comment", "move_task",
      "set_my_task_completion", "complete_task",
    ]));
    expect(names.some((name) => /delete|admin|permission|bulk/.test(name))).toBe(false);
  });

  it("validates input before calling ProjectRA", async () => {
    const call = vi.fn(async () => ({} as JsonValue));
    const client = await connectedClient(mockGateway(call));
    const result = await client.callTool({ name: "create_task", arguments: { projectId: "p", title: "" } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("Input validation error");
    expect(call).not.toHaveBeenCalled();
  });

  it("returns a gateway denial as an MCP tool error", async () => {
    const client = await connectedClient(mockGateway(
      vi.fn(async () => { throw new Error("Недостаточно прав."); }),
    ));
    const result = await client.callTool({ name: "move_task", arguments: { taskId: "t", targetColumnId: "c" } });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "Недостаточно прав." }]);
  });

  it("forwards a valid write with exact identifiers", async () => {
    const call = vi.fn(async () => ({ id: "task-1" } as JsonValue));
    const client = await connectedClient(mockGateway(call));
    const result = await client.callTool({
      name: "assign_task", arguments: { taskId: "task-1", userId: "user-2" },
    });
    expect(result.isError).not.toBe(true);
    expect(call).toHaveBeenCalledWith("assign_task", { taskId: "task-1", userId: "user-2" }, expect.any(AbortSignal));
  });

  it("forwards only the authenticated assignee's explicit completion state", async () => {
    const call = vi.fn(async () => ({ taskId: "task-1", completed: true } as JsonValue));
    const client = await connectedClient(mockGateway(call));
    const result = await client.callTool({
      name: "set_my_task_completion", arguments: { taskId: "task-1", completed: true },
    });
    expect(result.isError).not.toBe(true);
    expect(call).toHaveBeenCalledWith(
      "set_my_task_completion",
      { taskId: "task-1", completed: true },
      expect.any(AbortSignal),
    );
  });
});
