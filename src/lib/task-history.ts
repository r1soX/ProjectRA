import "server-only";
import { prisma } from "./prisma";

export type HistoryAction =
  | "created"
  | "title"
  | "description"
  | "column"
  | "priority"
  | "personal"
  | "assignee_add"
  | "assignee_remove"
  | "due"
  | "start"
  | "label_add"
  | "label_remove"
  | "completed"
  | "recurred"
  | "subtask_add"
  | "subtask_done"
  | "subtask_undone"
  | "subtask_remove"
  | "comment"
  | "comment_edit"
  | "comment_delete"
  | "time_logged"
  | "time_edit"
  | "time_delete"
  | "attachment_add"
  | "attachment_remove"
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
