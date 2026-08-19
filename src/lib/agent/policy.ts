export type AgentBoardRole = "OWNER" | "EDITOR" | "COMMENTER" | "VIEWER";

export interface BoardPolicyInput {
  actorId: string;
  ownerId: string;
  isPersonal: boolean;
  memberRole?: string | null;
  canViewAll: boolean;
  canManageAll: boolean;
}

export interface TaskPolicyInput {
  actorId: string;
  createdById: string;
  isPersonal: boolean;
  boardRole: AgentBoardRole | null;
  canViewAllTasks: boolean;
  canEditOwn: boolean;
  canEditAny: boolean;
}

export function resolveAgentBoardRole({
  actorId,
  ownerId,
  isPersonal,
  memberRole,
  canViewAll,
  canManageAll,
}: BoardPolicyInput): AgentBoardRole | null {
  if (actorId === ownerId) return "OWNER";
  if (memberRole) return memberRole as AgentBoardRole;
  if (canManageAll) return "OWNER";
  if (!isPersonal) return "EDITOR";
  return canViewAll ? "VIEWER" : null;
}

export function agentRoleCanEdit(role: AgentBoardRole | null): boolean {
  return role === "OWNER" || role === "EDITOR";
}

export function agentRoleCanComment(role: AgentBoardRole | null): boolean {
  return role === "OWNER" || role === "EDITOR" || role === "COMMENTER";
}

export function canAgentReadTask(input: TaskPolicyInput): boolean {
  if (!input.boardRole) return false;
  return (
    !input.isPersonal ||
    input.actorId === input.createdById ||
    input.canViewAllTasks
  );
}

export function canAgentEditTask(input: TaskPolicyInput): boolean {
  if (!canAgentReadTask(input) || !agentRoleCanEdit(input.boardRole)) {
    return false;
  }
  return (
    input.canEditAny ||
    (input.canEditOwn && input.actorId === input.createdById)
  );
}
