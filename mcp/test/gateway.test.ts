import { describe, expect, it, vi } from "vitest";
import { GatewayError, ProjectraGatewayClient } from "../src/gateway.js";

describe("ProjectRA gateway client", () => {
  it("sends the bearer token and operation envelope", async () => {
    const fetchImpl = vi.fn(async (_url: URL, init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true, data: { id: "task-1" } }), {
        status: 200, headers: { "content-type": "application/json" },
      }),
    );
    const gateway = new ProjectraGatewayClient({ baseUrl: "http://projectra.local", token: "secret", fetchImpl: fetchImpl as typeof fetch });
    await expect(gateway.call("get_task", { taskId: "task-1" })).resolves.toEqual({ id: "task-1" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("http://projectra.local/api/agent");
    expect(init?.headers).toMatchObject({ authorization: "Bearer secret" });
    expect(JSON.parse(String(init?.body))).toEqual({ operation: "get_task", input: { taskId: "task-1" } });
  });

  it("preserves a safe authorization failure from ProjectRA", async () => {
    const gateway = new ProjectraGatewayClient({
      baseUrl: "http://projectra.local", token: "secret",
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { code: "FORBIDDEN", message: "Недостаточно прав." } }), { status: 403 })) as typeof fetch,
    });
    await expect(gateway.call("move_task", { taskId: "t", targetColumnId: "c" }))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403, message: "Недостаточно прав." } satisfies Partial<GatewayError>);
  });

  it("does not leak a non-JSON upstream body", async () => {
    const gateway = new ProjectraGatewayClient({
      baseUrl: "http://projectra.local", token: "secret",
      fetchImpl: vi.fn(async () => new Response("database stack trace", { status: 500 })) as typeof fetch,
    });
    await expect(gateway.call("list_projects"))
      .rejects.toMatchObject({ code: "invalid_gateway_response", status: 500 });
  });
});
