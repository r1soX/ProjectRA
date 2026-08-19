import * as z from "zod/v4";

const id = z.string().trim().min(1).max(128);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z)?$/, {
    message: "Use YYYY-MM-DD or an ISO-8601 UTC timestamp.",
  });

export const listProjectsSchema = z.object({
  query: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(100).default(30),
});

export const projectIdSchema = z.object({ projectId: id });

export const searchTasksSchema = z.object({
  query: z.string().trim().min(2).max(300),
  projectId: id.optional(),
  assigneeId: id.optional(),
  status: z.string().trim().min(1).max(80).optional(),
  includeCompleted: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(30),
});

export const getTaskSchema = z.object({
  taskId: id,
  commentsLimit: z.number().int().min(0).max(100).default(30),
});

export const listMyTasksSchema = z.object({
  projectId: id.optional(),
  includeCompleted: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(50),
});

export const createTaskSchema = z.object({
  projectId: id,
  columnId: id.optional(),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(20_000).optional(),
  priority: z.enum(["NOT_URGENT", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  startDate: isoDate.optional(),
  dueDate: isoDate.optional(),
  assigneeIds: z.array(id).max(20).default([]),
  isPersonal: z.boolean().default(false),
});

export const updateTaskSchema = z
  .object({
    taskId: id,
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(20_000).nullable().optional(),
    priority: z.enum(["NOT_URGENT", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    startDate: isoDate.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
    isPersonal: z.boolean().optional(),
  })
  .refine(
    (value) =>
      Object.entries(value).some(
        ([key, field]) => key !== "taskId" && field !== undefined,
      ),
    { message: "Provide at least one field to update." },
  );

export const taskAssigneeSchema = z.object({ taskId: id, userId: id });

export const addCommentSchema = z.object({
  taskId: id,
  body: z.string().trim().min(1).max(10_000),
});

export const moveTaskSchema = z.object({
  taskId: id,
  targetColumnId: id,
});

export const setTaskStatusSchema = z.object({
  taskId: id,
  status: z.string().trim().min(1).max(80),
});

export const setMyTaskCompletionSchema = z.object({
  taskId: id,
  completed: z.boolean(),
});

export const taskIdSchema = z.object({ taskId: id });
