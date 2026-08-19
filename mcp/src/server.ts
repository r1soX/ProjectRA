import {
  McpServer,
  ResourceTemplate,
  type ServerContext,
} from "@modelcontextprotocol/server";

import type { JsonValue, ProjectraGateway } from "./types.js";
import {
  addCommentSchema,
  createTaskSchema,
  getTaskSchema,
  listMyTasksSchema,
  listProjectsSchema,
  moveTaskSchema,
  projectIdSchema,
  searchTasksSchema,
  setMyTaskCompletionSchema,
  setTaskStatusSchema,
  taskAssigneeSchema,
  taskIdSchema,
  updateTaskSchema,
} from "./schemas.js";

const INSTRUCTIONS = `ProjectRA is the source of truth. Projects are ProjectRA boards. Always resolve a project, column, task, and employee to an exact ID before a write. Never guess when names are ambiguous. Read project context before creating or moving tasks. Write tools act as the authenticated ProjectRA user and preserve ProjectRA permissions. Do not claim success unless the tool result confirms it. No deletion, bulk, user, role, permission, or admin operations are available.`;

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const SAFE_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const APPEND_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const WORKFLOW_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export function createProjectraMcpServer(gateway: ProjectraGateway): McpServer {
  const server = new McpServer(
    { name: "projectra", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );

  registerReadTools(server, gateway);
  registerWriteTools(server, gateway);
  registerResources(server, gateway);
  registerPrompts(server);

  return server;
}

function registerReadTools(server: McpServer, gateway: ProjectraGateway): void {
  server.registerTool(
    "list_projects",
    {
      title: "List ProjectRA projects",
      description: "List boards visible to the authenticated user with compact task and column counts.",
      inputSchema: listProjectsSchema,
      annotations: READ_ONLY,
    },
    async (input, ctx) => callGateway(gateway, "list_projects", input, ctx),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project context",
      description: "Get one board, its columns, statuses, role, capabilities, and compact task counts.",
      inputSchema: projectIdSchema,
      annotations: READ_ONLY,
    },
    async (input, ctx) => callGateway(gateway, "get_project", input, ctx),
  );

  server.registerTool(
    "list_project_members",
    {
      title: "List project members",
      description: "List employees that can be assigned work on a board. Use this before resolving a person by name.",
      inputSchema: projectIdSchema,
      annotations: READ_ONLY,
    },
    async (input, ctx) => callGateway(gateway, "list_project_members", input, ctx),
  );

  server.registerTool(
    "search_tasks",
    {
      title: "Search tasks",
      description: "Search accessible task titles and descriptions with optional project, assignee, and status filters.",
      inputSchema: searchTasksSchema,
      annotations: READ_ONLY,
    },
    async (input, ctx) => callGateway(gateway, "search_tasks", input, ctx),
  );

  server.registerTool(
    "get_task",
    {
      title: "Read a task",
      description: "Read a task including Markdown description, dates, status, assignees, recent comments, and capabilities.",
      inputSchema: getTaskSchema,
      annotations: READ_ONLY,
    },
    async (input, ctx) => callGateway(gateway, "get_task", input, ctx),
  );

  server.registerTool(
    "list_my_tasks",
    {
      title: "List my tasks",
      description: "List tasks assigned to the authenticated user, optionally limited to one project.",
      inputSchema: listMyTasksSchema,
      annotations: READ_ONLY,
    },
    async (input, ctx) => callGateway(gateway, "list_my_tasks", input, ctx),
  );

  server.registerTool(
    "get_project_summary",
    {
      title: "Project summary",
      description: "Return compact status, priority, assignee, overdue, and upcoming-deadline statistics for one project.",
      inputSchema: projectIdSchema,
      annotations: READ_ONLY,
    },
    async (input, ctx) => callGateway(gateway, "get_project_summary", input, ctx),
  );
}

function registerWriteTools(server: McpServer, gateway: ProjectraGateway): void {
  server.registerTool(
    "create_task",
    {
      title: "Create a task",
      description: "Create one task on an accessible board, optionally with Markdown description, dates, priority, and exact assignee IDs.",
      inputSchema: createTaskSchema,
      annotations: APPEND_WRITE,
    },
    async (input, ctx) => callGateway(gateway, "create_task", input, ctx),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task fields",
      description: "Update only the supplied task fields. Does not move, assign, comment, complete, or delete the task.",
      inputSchema: updateTaskSchema,
      annotations: SAFE_WRITE,
    },
    async (input, ctx) => callGateway(gateway, "update_task", input, ctx),
  );

  server.registerTool(
    "assign_task",
    {
      title: "Assign an employee",
      description: "Assign one exact ProjectRA user ID to a task. Repeating the call is safe.",
      inputSchema: taskAssigneeSchema,
      annotations: SAFE_WRITE,
    },
    async (input, ctx) => callGateway(gateway, "assign_task", input, ctx),
  );

  server.registerTool(
    "unassign_task",
    {
      title: "Remove an assignee",
      description: "Remove one exact ProjectRA user ID from a task. Repeating the call is safe.",
      inputSchema: taskAssigneeSchema,
      annotations: SAFE_WRITE,
    },
    async (input, ctx) => callGateway(gateway, "unassign_task", input, ctx),
  );

  server.registerTool(
    "add_task_comment",
    {
      title: "Add a task comment",
      description: "Append one Markdown comment to a task. Supports ProjectRA @username mentions.",
      inputSchema: addCommentSchema,
      annotations: APPEND_WRITE,
    },
    async (input, ctx) => callGateway(gateway, "add_task_comment", input, ctx),
  );

  server.registerTool(
    "move_task",
    {
      title: "Move a task",
      description: "Move one task to an exact column ID on the same board and update its inherited status.",
      inputSchema: moveTaskSchema,
      annotations: WORKFLOW_WRITE,
    },
    async (input, ctx) => callGateway(gateway, "move_task", input, ctx),
  );

  server.registerTool(
    "set_task_status",
    {
      title: "Set task status",
      description: "Set an exact ProjectRA status key without moving the card, or use auto to inherit the column status.",
      inputSchema: setTaskStatusSchema,
      annotations: WORKFLOW_WRITE,
    },
    async (input, ctx) => callGateway(gateway, "set_task_status", input, ctx),
  );

  server.registerTool(
    "set_my_task_completion",
    {
      title: "Mark my task work complete",
      description: "Set or clear the authenticated assignee's own completion confirmation. Cannot change another employee's confirmation.",
      inputSchema: setMyTaskCompletionSchema,
      annotations: SAFE_WRITE,
    },
    async (input, ctx) => callGateway(gateway, "set_my_task_completion", input, ctx),
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete a task",
      description: "Move one task to the board's protected completed column. Repeating the call is safe.",
      inputSchema: taskIdSchema,
      annotations: SAFE_WRITE,
    },
    async (input, ctx) => callGateway(gateway, "complete_task", input, ctx),
  );
}

function registerResources(server: McpServer, gateway: ProjectraGateway): void {
  server.registerResource(
    "project",
    new ResourceTemplate("project://{projectId}", { list: undefined }),
    {
      title: "ProjectRA project context",
      description: "Read-only project context, columns, members, and capabilities.",
      mimeType: "application/json",
    },
    async (uri, variables, ctx) => {
      const data = await gateway.call<JsonValue>(
        "get_project",
        { projectId: String(variables.projectId) },
        ctx.mcpReq.signal,
      );
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data) }] };
    },
  );

  server.registerResource(
    "task",
    new ResourceTemplate("task://{taskId}", { list: undefined }),
    {
      title: "ProjectRA task context",
      description: "Read-only task description, assignees, comments, and capabilities.",
      mimeType: "application/json",
    },
    async (uri, variables, ctx) => {
      const data = await gateway.call<JsonValue>(
        "get_task",
        { taskId: String(variables.taskId), commentsLimit: 30 },
        ctx.mcpReq.signal,
      );
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data) }] };
    },
  );
}

function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "project_review",
    {
      title: "Review a ProjectRA project",
      description: "Inspect a board and identify blockers, overdue work, ownership gaps, and next actions.",
      argsSchema: projectIdSchema,
    },
    ({ projectId }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Review ProjectRA project ${projectId}. Read project://${projectId}, inspect important tasks, then summarize blockers, overdue items, unassigned work, and concrete next actions. Do not modify anything.`,
        },
      }],
    }),
  );

  server.registerPrompt(
    "task_analysis",
    {
      title: "Analyze a ProjectRA task",
      description: "Understand a task, its discussion, missing information, and suggested next step.",
      argsSchema: taskIdSchema,
    },
    ({ taskId }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Read task://${taskId}. Explain the goal, constraints, current state, assignees, unresolved questions, and the most useful next action. Do not modify the task unless I explicitly ask.`,
        },
      }],
    }),
  );

  server.registerPrompt(
    "project_summary",
    {
      title: "Summarize a ProjectRA project",
      description: "Produce a concise management summary from current ProjectRA data.",
      argsSchema: projectIdSchema,
    },
    ({ projectId }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Call get_project_summary for project ${projectId}, inspect only the tasks needed to explain risks, and write a concise management summary with progress, deadlines, blockers, and owners.`,
        },
      }],
    }),
  );
}

async function callGateway(
  gateway: ProjectraGateway,
  operation: Parameters<ProjectraGateway["call"]>[0],
  input: Record<string, unknown>,
  ctx: ServerContext,
) {
  try {
    const data = await gateway.call<JsonValue>(
      operation,
      input as Record<string, JsonValue>,
      ctx.mcpReq.signal,
    );
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data) }],
      structuredContent:
        data !== null && typeof data === "object" && !Array.isArray(data)
          ? data
          : { result: data },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return toolError("Operation cancelled by the client.");
    }
    return toolError(safeMessage(error));
  }
}

function safeMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "ProjectRA could not complete the operation.";
}

function toolError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
