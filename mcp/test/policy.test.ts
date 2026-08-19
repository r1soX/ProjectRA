import { describe, expect, it } from "vitest";
import {
  canAgentEditTask,
  canAgentReadTask,
  resolveAgentBoardRole,
} from "../../src/lib/agent/policy";

describe("ProjectRA agent authorization policy", () => {
  it("keeps an unrelated personal project hidden", () => {
    expect(resolveAgentBoardRole({
      actorId: "user-a", ownerId: "user-b", isPersonal: true,
      memberRole: null, canViewAll: false, canManageAll: false,
    })).toBeNull();
  });

  it("gives a global viewer read-only access to a personal project", () => {
    expect(resolveAgentBoardRole({
      actorId: "user-a", ownerId: "user-b", isPersonal: true,
      memberRole: null, canViewAll: true, canManageAll: false,
    })).toBe("VIEWER");
  });

  it("honors an explicit viewer role on a shared project", () => {
    expect(resolveAgentBoardRole({
      actorId: "user-a", ownerId: "user-b", isPersonal: false,
      memberRole: "VIEWER", canViewAll: false, canManageAll: false,
    })).toBe("VIEWER");
  });

  it("hides another creator's personal task", () => {
    expect(canAgentReadTask({
      actorId: "user-a", createdById: "user-b", isPersonal: true,
      boardRole: "EDITOR", canViewAllTasks: false,
      canEditOwn: true, canEditAny: true,
    })).toBe(false);
  });

  it("does not let a board viewer edit even with task.edit.any", () => {
    expect(canAgentEditTask({
      actorId: "user-a", createdById: "user-b", isPersonal: false,
      boardRole: "VIEWER", canViewAllTasks: false,
      canEditOwn: true, canEditAny: true,
    })).toBe(false);
  });

  it("applies own-scope task editing", () => {
    const base = {
      actorId: "user-a", isPersonal: false, boardRole: "EDITOR" as const,
      canViewAllTasks: false, canEditOwn: true, canEditAny: false,
    };
    expect(canAgentEditTask({ ...base, createdById: "user-a" })).toBe(true);
    expect(canAgentEditTask({ ...base, createdById: "user-b" })).toBe(false);
  });
});

