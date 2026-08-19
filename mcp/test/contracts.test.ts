import { describe, expect, it } from "vitest";
import { agentRequestSchema } from "../../src/lib/agent/contracts";

describe("ProjectRA agent completion contract", () => {
  it("accepts an explicit completion state for the authenticated assignee", () => {
    expect(agentRequestSchema.parse({
      operation: "set_my_task_completion",
      input: { taskId: "task-1", completed: true },
    })).toEqual({
      operation: "set_my_task_completion",
      input: { taskId: "task-1", completed: true },
    });
  });

  it("does not accept a target user or an implicit toggle", () => {
    expect(() => agentRequestSchema.parse({
      operation: "set_my_task_completion",
      input: { taskId: "task-1" },
    })).toThrow();
    expect(() => agentRequestSchema.parse({
      operation: "set_my_task_completion",
      input: { taskId: "task-1", completed: true, userId: "user-2" },
    })).toThrow();
  });
});
