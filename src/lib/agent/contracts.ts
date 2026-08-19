import { z } from "zod";

const id = z.string().trim().min(1).max(128);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z)?$/);
const priority = z.enum(["NOT_URGENT", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const agentRequestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("whoami"), input: z.object({}).strict().default({}) }),
  z.object({
    operation: z.literal("list_projects"),
    input: z.object({ query: z.string().trim().max(120).optional(), limit: z.number().int().min(1).max(100).default(30) }).strict(),
  }),
  z.object({ operation: z.literal("get_project"), input: z.object({ projectId: id }).strict() }),
  z.object({ operation: z.literal("list_project_members"), input: z.object({ projectId: id }).strict() }),
  z.object({
    operation: z.literal("search_tasks"),
    input: z.object({
      query: z.string().trim().min(2).max(300),
      projectId: id.optional(),
      assigneeId: id.optional(),
      status: z.string().trim().min(1).max(80).optional(),
      includeCompleted: z.boolean().default(false),
      limit: z.number().int().min(1).max(100).default(30),
    }).strict(),
  }),
  z.object({
    operation: z.literal("get_task"),
    input: z.object({ taskId: id, commentsLimit: z.number().int().min(0).max(100).default(30) }).strict(),
  }),
  z.object({
    operation: z.literal("list_my_tasks"),
    input: z.object({ projectId: id.optional(), includeCompleted: z.boolean().default(false), limit: z.number().int().min(1).max(100).default(50) }).strict(),
  }),
  z.object({
    operation: z.literal("create_task"),
    input: z.object({
      projectId: id,
      columnId: id.optional(),
      title: z.string().trim().min(1).max(240),
      description: z.string().trim().max(20_000).optional(),
      priority: priority.default("MEDIUM"),
      startDate: isoDate.optional(),
      dueDate: isoDate.optional(),
      assigneeIds: z.array(id).max(20).default([]),
      isPersonal: z.boolean().default(false),
    }).strict(),
  }),
  z.object({
    operation: z.literal("update_task"),
    input: z.object({
      taskId: id,
      title: z.string().trim().min(1).max(240).optional(),
      description: z.string().trim().max(20_000).nullable().optional(),
      priority: priority.optional(),
      startDate: isoDate.nullable().optional(),
      dueDate: isoDate.nullable().optional(),
      isPersonal: z.boolean().optional(),
    }).strict().refine(
      (value) => Object.entries(value).some(([key, field]) => key !== "taskId" && field !== undefined),
      "Provide at least one field to update.",
    ),
  }),
  z.object({ operation: z.literal("assign_task"), input: z.object({ taskId: id, userId: id }).strict() }),
  z.object({ operation: z.literal("unassign_task"), input: z.object({ taskId: id, userId: id }).strict() }),
  z.object({ operation: z.literal("add_task_comment"), input: z.object({ taskId: id, body: z.string().trim().min(1).max(10_000) }).strict() }),
  z.object({ operation: z.literal("move_task"), input: z.object({ taskId: id, targetColumnId: id }).strict() }),
  z.object({ operation: z.literal("set_task_status"), input: z.object({ taskId: id, status: z.string().trim().min(1).max(80) }).strict() }),
  z.object({ operation: z.literal("set_my_task_completion"), input: z.object({ taskId: id, completed: z.boolean() }).strict() }),
  z.object({ operation: z.literal("complete_task"), input: z.object({ taskId: id }).strict() }),
  z.object({ operation: z.literal("get_project_summary"), input: z.object({ projectId: id }).strict() }),
]);

export type AgentRequest = z.infer<typeof agentRequestSchema>;
