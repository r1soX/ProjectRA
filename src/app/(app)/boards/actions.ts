"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getBoardRole, canEdit } from "@/lib/boards";
import { normalizePriority } from "@/lib/priority";
import { publishBoard } from "@/lib/realtime";

export type ActionState = { ok?: boolean; error?: string; message?: string };

const DEFAULT_COLUMNS = ["К работе", "В процессе", "Готово"];

// ── helpers ──────────────────────────────────────────────────────

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
 * A task may be modified/deleted only by its creator or an administrator.
 * Returns the task (boardId + createdById) or null if it no longer exists;
 * throws if the current user is not allowed.
 */
async function requireTaskMutator(taskId: string) {
  const user = await requireUser();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { boardId: true, createdById: true },
  });
  if (!task) return null;

  if (user.role === "ADMIN") return { user, task };

  const role = await getBoardRole(task.boardId, user.id);
  if (!role) throw new Error("Нет доступа к доске");
  if (task.createdById !== user.id) {
    throw new Error("Изменять задачу может только её создатель или администратор");
  }
  return { user, task };
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
  const parsed = boardSchema.safeParse({
    title: formData.get("title"),
    color: formData.get("color") || undefined,
    isPersonal: formData.get("isPersonal") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const board = await prisma.board.create({
    data: {
      title: parsed.data.title,
      color: parsed.data.color || "#0ea5e9",
      isPersonal: parsed.data.isPersonal,
      ownerId: user.id,
      columns: {
        create: DEFAULT_COLUMNS.map((title, i) => ({ title, order: i })),
      },
    },
  });
  revalidatePath("/boards");
  return { ok: true, message: board.id };
}

export async function updateBoard(
  boardId: string,
  title: string,
  color: string,
  isPersonal: boolean,
) {
  await requireBoardOwner(boardId);
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
  return board;
}

export async function addMember(
  boardId: string,
  userId: string,
  role: "EDITOR" | "VIEWER",
) {
  const board = await requireBoardOwner(boardId);
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
  await requireBoardOwner(boardId);
  await prisma.boardMember
    .delete({ where: { boardId_userId: { boardId, userId } } })
    .catch(() => {});
  bump(boardId);
}

// ── columns ──────────────────────────────────────────────────────

export async function createColumn(boardId: string, title: string) {
  await requireBoardEditor(boardId);
  const count = await prisma.column.count({ where: { boardId } });
  await prisma.column.create({
    data: { boardId, title: title.trim() || "Новая колонка", order: count },
  });
  bump(boardId);
}

export async function renameColumn(columnId: string, title: string) {
  const boardId = await boardIdOfColumn(columnId);
  if (!boardId) return;
  await requireBoardEditor(boardId);
  await prisma.column.update({
    where: { id: columnId },
    data: { title: title.trim() || "Без названия" },
  });
  bump(boardId);
}

export async function deleteColumn(columnId: string) {
  const boardId = await boardIdOfColumn(columnId);
  if (!boardId) return;
  await requireBoardEditor(boardId);
  await prisma.column.delete({ where: { id: columnId } });
  bump(boardId);
}

// ── tasks ────────────────────────────────────────────────────────

export async function createTask(columnId: string, title: string) {
  const boardId = await boardIdOfColumn(columnId);
  if (!boardId) return;
  const user = await requireBoardEditor(boardId);
  const count = await prisma.task.count({ where: { columnId } });
  await prisma.task.create({
    data: {
      boardId,
      columnId,
      title: title.trim() || "Новая задача",
      order: count,
      createdById: user.id,
    },
  });
  bump(boardId);
}

export async function updateTask(taskId: string, formData: FormData) {
  const ctx = await requireTaskMutator(taskId);
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
    },
  });
  bump(boardId);
  return { ok: true } as ActionState;
}

export async function deleteTask(taskId: string) {
  const ctx = await requireTaskMutator(taskId);
  if (!ctx) return;
  await prisma.task.delete({ where: { id: taskId } });
  bump(ctx.task.boardId);
}

/** Reschedule a task's due date (used by the calendar). */
export async function setTaskDue(taskId: string, date: string | null) {
  const ctx = await requireTaskMutator(taskId);
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
  await requireBoardEditor(boardId);

  const col = await prisma.column.findUnique({
    where: { id: toColumnId },
    select: { boardId: true },
  });
  if (!col || col.boardId !== boardId) return;

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
  await requireBoardEditor(boardId);
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

  await prisma.comment.create({ data: { taskId, userId: user.id, body } });
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
  if (comment.userId !== user.id) {
    throw new Error("Редактировать можно только свой комментарий");
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

  const boardId = comment.task.boardId;
  const role = await getBoardRole(boardId, user.id);
  if (comment.userId !== user.id && role !== "OWNER") {
    throw new Error("Можно удалить только свой комментарий");
  }
  await prisma.comment.delete({ where: { id: commentId } });
  bump(boardId);
}

export async function toggleAssignee(taskId: string, userId: string) {
  const ctx = await requireTaskMutator(taskId);
  if (!ctx) return;
  const boardId = ctx.task.boardId;

  const existing = await prisma.taskAssignee.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (existing) {
    await prisma.taskAssignee.delete({
      where: { taskId_userId: { taskId, userId } },
    });
  } else {
    await prisma.taskAssignee.create({ data: { taskId, userId } });
  }
  bump(boardId);
}
