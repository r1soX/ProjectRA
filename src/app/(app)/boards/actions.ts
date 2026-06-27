"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getBoardRole, canEdit } from "@/lib/boards";
import { normalizePriority } from "@/lib/priority";
import { ruleFromTask, nextOccurrence } from "@/lib/recurrence";
import { publishBoard } from "@/lib/realtime";
import { notifyMentions, notifyAssigned } from "@/lib/notify";
import { logHistory } from "@/lib/task-history";
import { shortName } from "@/lib/names";
import { hasPerm, PERMS } from "@/lib/permissions";

function normalizeRecurFreq(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v : "";
  return s === "DAILY" || s === "WEEKLY" || s === "MONTHLY" ? s : null;
}

export type ActionState = { ok?: boolean; error?: string; message?: string };

const DEFAULT_COLUMNS = ["К работе", "В процессе", "Готово"];

// ── helpers ──────────────────────────────────────────────────────

/** Бросает ошибку если у пользователя нет указанного разрешения. */
async function requirePerm(
  user: { id: string; role: string },
  perm: (typeof PERMS)[keyof typeof PERMS],
) {
  if (!(await hasPerm(user.id, user.role, perm))) throw new Error("Недостаточно прав");
}

async function requireBoardEditor(boardId: string) {
  const user = await requireUser();
  const role = await getBoardRole(boardId, user.id);
  if (!canEdit(role)) throw new Error("Нет прав на редактирование доски");
  return user;
}

// Revalidate the board's server components AND push a realtime event.
function bump(boardId: string) {
  revalidatePath(`/boards/${boardId}`);
  publishBoard(boardId);
}

async function boardIdOfColumn(columnId: string) {
  const c = await prisma.column.findUnique({
    where: { id: columnId },
    select: { boardId: true },
  });
  return c?.boardId ?? null;
}

async function boardIdOfTask(taskId: string) {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: { boardId: true },
  });
  return t?.boardId ?? null;
}

/**
 * Проверяет право редактировать задачу:
 *  – TASK_EDIT_ANY  → любую задачу
 *  – TASK_EDIT_OWN  → только свою
 */
async function requireTaskEditor(taskId: string) {
  const user = await requireUser();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { boardId: true, createdById: true },
  });
  if (!task) return null;

  const role = await getBoardRole(task.boardId, user.id);
  if (!role) throw new Error("Нет доступа к доске");

  const editAny = await hasPerm(user.id, user.role, PERMS.TASK_EDIT_ANY);
  if (editAny) return { user, task };

  const editOwn = await hasPerm(user.id, user.role, PERMS.TASK_EDIT_OWN);
  if (editOwn && task.createdById === user.id) return { user, task };

  throw new Error("Нет прав на редактирование задачи");
}

/**
 * Проверяет право удалять задачу:
 *  – TASK_DELETE_ANY → любую
 *  – TASK_DELETE_OWN → только свою
 */
async function requireTaskDeleter(taskId: string) {
  const user = await requireUser();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { boardId: true, createdById: true },
  });
  if (!task) return null;

  const role = await getBoardRole(task.boardId, user.id);
  if (!role) throw new Error("Нет доступа к доске");

  const delAny = await hasPerm(user.id, user.role, PERMS.TASK_DELETE_ANY);
  if (delAny) return { user, task };

  const delOwn = await hasPerm(user.id, user.role, PERMS.TASK_DELETE_OWN);
  if (delOwn && task.createdById === user.id) return { user, task };

  throw new Error("Нет прав на удаление задачи");
}

function parseDate(v: FormDataEntryValue | null): Date | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? new Date(s) : null;
}

// ── boards ───────────────────────────────────────────────────────

const boardSchema = z.object({
  title: z.string().trim().min(1, "Введите название"),
  color: z.string().trim().optional(),
  isPersonal: z.boolean(),
});

export async function createBoard(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  await requirePerm(user, PERMS.BOARD_CREATE);
  const parsed = boardSchema.safeParse({
    title: formData.get("title"),
    color: formData.get("color") || undefined,
    isPersonal: formData.get("isPersonal") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const columnsCreate = await columnsForNewBoard(
    String(formData.get("templateId") ?? ""),
  );

  const board = await prisma.board.create({
    data: {
      title: parsed.data.title,
      color: parsed.data.color || "#0ea5e9",
      isPersonal: parsed.data.isPersonal,
      ownerId: user.id,
      columns: { create: columnsCreate },
    },
  });
  revalidatePath("/boards");
  return { ok: true, message: board.id };
}

type NewColumn = {
  title: string;
  order: number;
  isSystem: boolean;
  systemKey: string | null;
};

/**
 * Columns for a freshly created board: from a template if a valid id is given,
 * otherwise the default set. Always guarantees the "Завершённые задачи" column.
 */
async function columnsForNewBoard(templateId: string): Promise<NewColumn[]> {
  let cols: NewColumn[] | null = null;

  if (templateId) {
    const tpl = await prisma.boardTemplate.findUnique({
      where: { id: templateId },
      include: { columns: { orderBy: { order: "asc" } } },
    });
    if (tpl && tpl.columns.length) {
      cols = tpl.columns.map((c, i) => ({
        title: c.title,
        order: i,
        isSystem: c.isSystem,
        systemKey: c.systemKey,
      }));
    }
  }

  if (!cols) {
    cols = DEFAULT_COLUMNS.map((title, i) => ({
      title,
      order: i,
      isSystem: false,
      systemKey: null,
    }));
  }

  if (!cols.some((c) => c.systemKey === "COMPLETED")) {
    cols.push({
      title: "Завершённые задачи",
      order: cols.length,
      isSystem: true,
      systemKey: "COMPLETED",
    });
  }
  return cols;
}

export async function updateBoard(
  boardId: string,
  title: string,
  color: string,
  isPersonal: boolean,
) {
  const { user } = await requireBoardOwner(boardId);
  await requirePerm(user, PERMS.BOARD_EDIT);
  await prisma.board.update({
    where: { id: boardId },
    data: { title: title.trim(), color, isPersonal },
  });
  bump(boardId);
  revalidatePath("/boards");
}

export async function deleteBoard(boardId: string) {
  const user = await requireUser();
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  });
  if (!board || board.ownerId !== user.id) {
    throw new Error("Удалить доску может только владелец");
  }
  await requirePerm(user, PERMS.BOARD_DELETE);
  await prisma.board.delete({ where: { id: boardId } });
  revalidatePath("/boards");
  redirect("/boards");
}

// ── members ──────────────────────────────────────────────────────

async function requireBoardOwner(boardId: string) {
  const user = await requireUser();
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, isPersonal: true },
  });
  if (!board || board.ownerId !== user.id) {
    throw new Error("Только владелец управляет участниками");
  }
  return { user, board };
}

export async function addMember(
  boardId: string,
  userId: string,
  role: "EDITOR" | "VIEWER",
) {
  const { user, board } = await requireBoardOwner(boardId);
  await requirePerm(user, PERMS.BOARD_MANAGE_MEMBERS);
  if (!board.isPersonal)
    throw new Error("Общая доска доступна всем — участники не нужны");
  await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId, userId } },
    create: { boardId, userId, role },
    update: { role },
  });
  bump(boardId);
}

export async function removeMember(boardId: string, userId: string) {
  const { user } = await requireBoardOwner(boardId);
  await requirePerm(user, PERMS.BOARD_MANAGE_MEMBERS);
  await prisma.boardMember
    .delete({ where: { boardId_userId: { boardId, userId } } })
    .catch(() => {});
  bump(boardId);
}

// ── columns ──────────────────────────────────────────────────────

export async function createColumn(boardId: string, title: string) {
  const user = await requireBoardEditor(boardId);
  await requirePerm(user, PERMS.COLUMN_CREATE);
  const count = await prisma.column.count({ where: { boardId } });
  await prisma.column.create({
    data: { boardId, title: title.trim() || "Новая колонка", order: count },
  });
  bump(boardId);
}

export async function renameColumn(columnId: string, title: string) {
  const col = await prisma.column.findUnique({
    where: { id: columnId },
    select: { boardId: true, isSystem: true },
  });
  if (!col || col.isSystem) return;
  const user = await requireBoardEditor(col.boardId);
  await requirePerm(user, PERMS.COLUMN_EDIT);
  await prisma.column.update({
    where: { id: columnId },
    data: { title: title.trim() || "Без названия" },
  });
  bump(col.boardId);
}

export async function deleteColumn(columnId: string) {
  const col = await prisma.column.findUnique({
    where: { id: columnId },
    select: { boardId: true, isSystem: true },
  });
  if (!col || col.isSystem) return;
  const boardId = col.boardId;
  const user = await requireBoardEditor(boardId);
  await requirePerm(user, PERMS.COLUMN_DELETE);
  await prisma.column.delete({ where: { id: columnId } });
  bump(boardId);
}

// ── tasks ────────────────────────────────────────────────────────

export async function createTask(columnId: string, title: string) {
  const boardId = await boardIdOfColumn(columnId);
  if (!boardId) return;
  const user = await requireBoardEditor(boardId);
  await requirePerm(user, PERMS.TASK_CREATE);
  const count = await prisma.task.count({ where: { columnId } });
  const task = await prisma.task.create({
    data: {
      boardId,
      columnId,
      title: title.trim() || "Новая задача",
      order: count,
      createdById: user.id,
    },
  });
  await logHistory(task.id, user.id, "created", { after: task.title });
  bump(boardId);
}

export async function updateTask(taskId: string, formData: FormData) {
  const ctx = await requireTaskEditor(taskId);
  if (!ctx) return { error: "Задача не найдена" } as ActionState;
  const boardId = ctx.task.boardId;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Введите название задачи" } as ActionState;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      color: String(formData.get("color") ?? "").trim() || null,
      priority: normalizePriority(formData.get("priority")),
      isPersonal: formData.get("isPersonal") === "on",
      startDate: parseDate(formData.get("startDate")),
      dueDate: parseDate(formData.get("dueDate")),
      recurFreq: normalizeRecurFreq(formData.get("recurFreq")),
      recurInterval: Math.max(
        1,
        parseInt(String(formData.get("recurInterval") ?? "1"), 10) || 1,
      ),
      recurDays: String(formData.get("recurDays") ?? "").trim() || null,
      recurUntil: parseDate(formData.get("recurUntil")),
    },
  });
  bump(boardId);
  return { ok: true } as ActionState;
}

export async function deleteTask(taskId: string) {
  const ctx = await requireTaskDeleter(taskId);
  if (!ctx) return;
  await prisma.task.delete({ where: { id: taskId } });
  bump(ctx.task.boardId);
}

/**
 * "Выполнить" a recurring task: advance its due date to the next occurrence.
 * Workflow action — any board editor may do it.
 */
export async function completeRecurring(taskId: string) {
  const boardId = await boardIdOfTask(taskId);
  if (!boardId) return;
  const user = await requireBoardEditor(boardId);
  await requirePerm(user, PERMS.TASK_COMPLETE);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      recurFreq: true,
      recurInterval: true,
      recurDays: true,
      recurUntil: true,
      dueDate: true,
    },
  });
  if (!task) return;
  const rule = ruleFromTask({
    recurFreq: task.recurFreq,
    recurInterval: task.recurInterval,
    recurDays: task.recurDays,
    recurUntil: task.recurUntil
      ? task.recurUntil.toISOString().slice(0, 10)
      : null,
  });
  if (!rule) return;

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const due = task.dueDate ?? today;
  const base = due > today ? due : today;
  const next = nextOccurrence(rule, base);

  await prisma.task.update({
    where: { id: taskId },
    // No more occurrences → stop the recurrence but keep the task.
    data: next ? { dueDate: next } : { recurFreq: null },
  });
  bump(boardId);
}

/** Reschedule a task's due date (used by the calendar). */
export async function setTaskDue(taskId: string, date: string | null) {
  const ctx = await requireTaskEditor(taskId);
  if (!ctx) return;
  await prisma.task.update({
    where: { id: taskId },
    data: { dueDate: date ? new Date(date) : null },
  });
  bump(ctx.task.boardId);
  revalidatePath("/calendar");
}

// ── task links (visual dependencies) ─────────────────────────────

export async function createTaskLink(
  boardId: string,
  sourceTaskId: string,
  targetTaskId: string,
  type: string,
): Promise<{ id: string } | null> {
  await requireBoardEditor(boardId);
  if (sourceTaskId === targetTaskId) return null;

  const inBoard = await prisma.task.count({
    where: { id: { in: [sourceTaskId, targetTaskId] }, boardId },
  });
  if (inBoard !== 2) return null;

  const t = ["RELATES", "BLOCKS", "DEPENDS"].includes(type) ? type : "RELATES";
  const link = await prisma.taskLink.upsert({
    where: { sourceTaskId_targetTaskId: { sourceTaskId, targetTaskId } },
    create: { boardId, sourceTaskId, targetTaskId, type: t },
    update: { type: t },
    select: { id: true },
  });
  revalidatePath(`/boards/${boardId}/links`);
  publishBoard(boardId);
  return { id: link.id };
}

export async function deleteTaskLink(linkId: string) {
  const link = await prisma.taskLink.findUnique({
    where: { id: linkId },
    select: { boardId: true },
  });
  if (!link) return;
  await requireBoardEditor(link.boardId);
  await prisma.taskLink.delete({ where: { id: linkId } });
  revalidatePath(`/boards/${link.boardId}/links`);
  publishBoard(link.boardId);
}

export async function setTaskPosition(taskId: string, x: number, y: number) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { boardId: true },
  });
  if (!task) return;
  await requireBoardEditor(task.boardId);
  await prisma.task.update({
    where: { id: taskId },
    data: { canvasX: x, canvasY: y },
  });
}

/**
 * Move a task to a column and persist the destination column's order.
 * Moving cards is a workflow action — any board editor may do it (unlike
 * editing task content, which is restricted to the creator/admin).
 */
export async function moveTask(
  taskId: string,
  toColumnId: string,
  orderedIds: string[],
) {
  const boardId = await boardIdOfTask(taskId);
  if (!boardId) return;
  const user = await requireBoardEditor(boardId);
  await requirePerm(user, PERMS.TASK_MOVE);

  const col = await prisma.column.findUnique({
    where: { id: toColumnId },
    select: { boardId: true, systemKey: true },
  });
  if (!col || col.boardId !== boardId) return;

  // Moving into "Завершённые задачи": only the creator/admin, and only after
  // every assignee has confirmed completion.
  if (col.systemKey === "COMPLETED") {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        createdById: true,
        assignees: { select: { confirmed: true } },
      },
    });
    if (!task) return;
    if (user.role !== "ADMIN" && task.createdById !== user.id) {
      throw new Error(
        "В «Завершённые задачи» переносит только постановщик задачи или администратор",
      );
    }
    const allConfirmed =
      task.assignees.length === 0 || task.assignees.every((a) => a.confirmed);
    if (!allConfirmed) {
      throw new Error("Не все исполнители подтвердили выполнение задачи");
    }
  }

  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data: { columnId: toColumnId } }),
    ...orderedIds.map((id, i) =>
      prisma.task.update({ where: { id }, data: { order: i } }),
    ),
  ]);
  bump(boardId);
}

/** Persist a new column order for the board. */
export async function reorderColumns(boardId: string, orderedIds: string[]) {
  const user = await requireBoardEditor(boardId);
  await requirePerm(user, PERMS.COLUMN_EDIT);
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.column.update({ where: { id }, data: { order: i } }),
    ),
  );
  bump(boardId);
}

// ── comments ─────────────────────────────────────────────────────

export async function addComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const taskId = String(formData.get("taskId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Введите комментарий" };

  const boardId = await boardIdOfTask(taskId);
  if (!boardId) return { error: "Задача не найдена" };

  const user = await requireUser();
  const role = await getBoardRole(boardId, user.id);
  if (!role) return { error: "Нет доступа к доске" };
  if (!(await hasPerm(user.id, user.role, PERMS.COMMENT_CREATE))) {
    return { error: "Недостаточно прав" };
  }

  const comment = await prisma.comment.create({
    data: { taskId, userId: user.id, body },
  });

  // @-mentions
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { title: true, boardId: true },
  });
  if (task) {
    await notifyMentions(
      body,
      user.id,
      shortName(user),
      taskId,
      task.title,
      task.boardId,
      comment.id,
    );
  }

  bump(boardId);
  return { ok: true };
}

export async function editComment(commentId: string, body: string) {
  const user = await requireUser();
  const text = body.trim();
  if (!text) return;
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, task: { select: { boardId: true } } },
  });
  if (!comment) return;
  const editAny = await hasPerm(user.id, user.role, PERMS.COMMENT_EDIT_ANY);
  const editOwn = await hasPerm(user.id, user.role, PERMS.COMMENT_EDIT_OWN);
  if (!editAny && !(editOwn && comment.userId === user.id)) {
    throw new Error("Нет прав на редактирование комментария");
  }
  await prisma.comment.update({ where: { id: commentId }, data: { body: text } });
  bump(comment.task.boardId);
}

export async function deleteComment(commentId: string) {
  const user = await requireUser();
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, task: { select: { boardId: true } } },
  });
  if (!comment) return;

  const delAny = await hasPerm(user.id, user.role, PERMS.COMMENT_DELETE_ANY);
  const delOwn = await hasPerm(user.id, user.role, PERMS.COMMENT_DELETE_OWN);
  if (!delAny && !(delOwn && comment.userId === user.id)) {
    throw new Error("Нет прав на удаление комментария");
  }
  await prisma.comment.delete({ where: { id: commentId } });
  bump(comment.task.boardId);
}

/** An assignee confirms (or un-confirms) that they completed the task. */
export async function toggleAssigneeConfirm(taskId: string) {
  const user = await requireUser();
  const row = await prisma.taskAssignee.findUnique({
    where: { taskId_userId: { taskId, userId: user.id } },
    select: { confirmed: true },
  });
  if (!row) return; // only assignees can confirm their own completion
  await prisma.taskAssignee.update({
    where: { taskId_userId: { taskId, userId: user.id } },
    data: { confirmed: !row.confirmed },
  });
  const boardId = await boardIdOfTask(taskId);
  if (boardId) bump(boardId);
}

export async function toggleAssignee(taskId: string, userId: string) {
  const ctx = await requireTaskEditor(taskId);
  if (ctx) await requirePerm(ctx.user, PERMS.TASK_ASSIGN);
  if (!ctx) return;
  const { user, task: ctxTask } = ctx;
  const boardId = ctxTask.boardId;

  const existing = await prisma.taskAssignee.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (existing) {
    await prisma.taskAssignee.delete({ where: { taskId_userId: { taskId, userId } } });
    await logHistory(taskId, user.id, "assignee_remove", { name: userId });
  } else {
    await prisma.taskAssignee.create({ data: { taskId, userId } });
    await logHistory(taskId, user.id, "assignee_add", { name: userId });
    if (userId !== user.id) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { title: true, boardId: true },
      });
      if (task) {
        await notifyAssigned(userId, shortName(user), taskId, task.title, task.boardId);
      }
    }
  }
  bump(boardId);
}

// ── subtasks ──────────────────────────────────────────────────────

export async function createSubtask(parentTaskId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;

  const parent = await prisma.task.findUnique({
    where: { id: parentTaskId },
    select: { boardId: true, columnId: true },
  });
  if (!parent) return;

  const user = await requireUser();
  const role = await getBoardRole(parent.boardId, user.id);
  if (!canEdit(role)) throw new Error("Нет прав");
  await requirePerm(user, PERMS.TASK_CREATE);

  // Place in same column as parent (not COMPLETED)
  const firstCol = await prisma.column.findFirst({
    where: { boardId: parent.boardId, systemKey: null },
    orderBy: { order: "asc" },
  });
  const colId = firstCol?.id ?? parent.columnId;
  const count = await prisma.task.count({ where: { columnId: colId } });

  const sub = await prisma.task.create({
    data: {
      boardId: parent.boardId,
      columnId: colId,
      parentId: parentTaskId,
      title: trimmed,
      order: count,
      createdById: user.id,
    },
  });
  await logHistory(parentTaskId, user.id, "subtask_add", { after: trimmed });
  bump(parent.boardId);
  return sub.id;
}

export async function toggleSubtaskDone(subtaskId: string) {
  const user = await requireUser();
  const sub = await prisma.task.findUnique({
    where: { id: subtaskId },
    select: {
      boardId: true,
      parentId: true,
      column: { select: { systemKey: true } },
    },
  });
  if (!sub) return;

  const role = await getBoardRole(sub.boardId, user.id);
  if (!role) throw new Error("Нет доступа");
  if (!(await hasPerm(user.id, user.role, PERMS.TASK_COMPLETE))) {
    throw new Error("Недостаточно прав");
  }

  const isDone = sub.column.systemKey === "COMPLETED";

  if (isDone) {
    // Un-done: move back to first non-system column
    const firstCol = await prisma.column.findFirst({
      where: { boardId: sub.boardId, systemKey: null },
      orderBy: { order: "asc" },
    });
    if (firstCol) {
      await prisma.task.update({
        where: { id: subtaskId },
        data: { columnId: firstCol.id },
      });
    }
  } else {
    // Done: move to COMPLETED column
    const completed = await prisma.column.findFirst({
      where: { boardId: sub.boardId, systemKey: "COMPLETED" },
    });
    if (completed) {
      await prisma.task.update({
        where: { id: subtaskId },
        data: { columnId: completed.id },
      });
    }
  }
  bump(sub.boardId);
}

export async function deleteSubtask(subtaskId: string) {
  // Only a real subtask (has a parent) may be deleted here…
  const sub = await prisma.task.findUnique({
    where: { id: subtaskId },
    select: { parentId: true },
  });
  if (!sub || !sub.parentId) return;
  // …and only with the proper delete permission (own/any), like deleteTask.
  const ctx = await requireTaskDeleter(subtaskId);
  if (!ctx) return;
  await prisma.task.delete({ where: { id: subtaskId } });
  bump(ctx.task.boardId);
}

// ── labels ───────────────────────────────────────────────────────

export async function createLabel(
  boardId: string,
  name: string,
  color: string,
): Promise<{ id: string } | null> {
  const user = await requireBoardEditor(boardId);
  await requirePerm(user, PERMS.LABEL_CREATE);
  const trimmed = name.trim();
  if (!trimmed) return null;
  const label = await prisma.label.create({
    data: { boardId, name: trimmed.slice(0, 40), color: color || "#888888" },
    select: { id: true },
  });
  bump(boardId);
  return { id: label.id };
}

export async function editLabel(labelId: string, name: string, color: string) {
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { boardId: true },
  });
  if (!label) return;
  const user = await requireBoardEditor(label.boardId);
  await requirePerm(user, PERMS.LABEL_EDIT);
  const trimmed = name.trim();
  if (!trimmed) return;
  await prisma.label.update({
    where: { id: labelId },
    data: { name: trimmed.slice(0, 40), color: color || "#888888" },
  });
  bump(label.boardId);
}

export async function deleteLabel(labelId: string) {
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { boardId: true },
  });
  if (!label) return;
  const user = await requireBoardEditor(label.boardId);
  await requirePerm(user, PERMS.LABEL_DELETE);
  await prisma.label.delete({ where: { id: labelId } });
  bump(label.boardId);
}

/** Assign / unassign a board label to a task (a task-edit operation). */
export async function toggleTaskLabel(taskId: string, labelId: string) {
  const ctx = await requireTaskEditor(taskId);
  if (!ctx) return;
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { boardId: true },
  });
  if (!label || label.boardId !== ctx.task.boardId) return;

  const existing = await prisma.taskLabel.findUnique({
    where: { taskId_labelId: { taskId, labelId } },
  });
  if (existing) {
    await prisma.taskLabel.delete({ where: { taskId_labelId: { taskId, labelId } } });
    await logHistory(taskId, ctx.user.id, "label_remove", { name: labelId });
  } else {
    await prisma.taskLabel.create({ data: { taskId, labelId } });
    await logHistory(taskId, ctx.user.id, "label_add", { name: labelId });
  }
  bump(ctx.task.boardId);
}

// ── time tracking ─────────────────────────────────────────────────

export async function logTime(
  taskId: string,
  minutes: number,
  note: string,
): Promise<ActionState> {
  if (!minutes || minutes < 1) return { error: "Укажите время" };

  const boardId = await boardIdOfTask(taskId);
  if (!boardId) return { error: "Задача не найдена" };

  const user = await requireUser();
  const role = await getBoardRole(boardId, user.id);
  if (!role) return { error: "Нет доступа" };
  if (!(await hasPerm(user.id, user.role, PERMS.TIME_LOG))) {
    return { error: "Недостаточно прав" };
  }

  await prisma.timeEntry.create({
    data: { taskId, userId: user.id, minutes, note: note.trim() || null },
  });
  await logHistory(taskId, user.id, "time_logged", { minutes, note: note.trim() || null });
  bump(boardId);
  return { ok: true };
}

export async function editTimeEntry(
  entryId: string,
  minutes: number,
  note: string,
): Promise<ActionState> {
  if (!minutes || minutes < 1) return { error: "Укажите время" };
  const user = await requireUser();
  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, task: { select: { boardId: true } } },
  });
  if (!entry) return { error: "Не найдено" };
  // Only the author may edit, and only with the TIME_EDIT_OWN permission.
  if (
    entry.userId !== user.id ||
    !(await hasPerm(user.id, user.role, PERMS.TIME_EDIT_OWN))
  ) {
    return { error: "Нет прав на изменение записи" };
  }
  await prisma.timeEntry.update({
    where: { id: entryId },
    data: { minutes, note: note.trim() || null },
  });
  bump(entry.task.boardId);
  return { ok: true };
}

export async function deleteTimeEntry(entryId: string): Promise<ActionState> {
  const user = await requireUser();
  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, task: { select: { boardId: true } } },
  });
  if (!entry) return { error: "Не найдено" };
  const canDel = entry.userId === user.id
    ? await hasPerm(user.id, user.role, PERMS.TIME_DELETE_OWN)
    : user.role === "ADMIN";
  if (!canDel) return { error: "Нет прав на удаление записи" };
  await prisma.timeEntry.delete({ where: { id: entryId } });
  bump(entry.task.boardId);
  return { ok: true };
}
