export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type AgentOperation =
  | "whoami"
  | "list_projects"
  | "get_project"
  | "list_project_members"
  | "search_tasks"
  | "get_task"
  | "list_my_tasks"
  | "create_task"
  | "update_task"
  | "assign_task"
  | "unassign_task"
  | "add_task_comment"
  | "move_task"
  | "set_task_status"
  | "complete_task"
  | "get_project_summary";

export interface GatewaySuccess<T> {
  ok: true;
  data: T;
}

export interface GatewayFailure {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type GatewayResponse<T> = GatewaySuccess<T> | GatewayFailure;

export interface IdentityResult {
  id: string;
  username: string;
  displayName: string;
  expiresAt: number;
}

export interface ProjectraGateway {
  call<T extends JsonValue>(
    operation: AgentOperation,
    input?: Record<string, JsonValue>,
    signal?: AbortSignal,
  ): Promise<T>;
}
