import "server-only";
import { prisma } from "./prisma";

export type HistoryAction =
  | "created"
  | "title"
  | "description"
  | "column"
  | "priority"
  | "assignee_add"
  | "assignee_remove"
  | "due"
  | "start"
  | "label_add"
  | "label_remove"
  | "completed"
  | "subtask_add"
  | "time_logged"
  | "attachment_add"
  | "color";

interface HistoryMeta {
  before?: string | null;
  after?: string | null;
  name?: string;
  minutes?: number | null;
  note?: string | null;
}

export async function logHistory(
  taskId: string,
  userId: string,
  action: HistoryAction,
  meta?: HistoryMeta,
) {
  await prisma.taskHistory.create({
    data: {
      taskId,
      userId,
      action,
      meta: meta ? JSON.stringify(meta) : null,
    },
  });
}
