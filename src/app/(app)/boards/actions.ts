"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getBoardRole, canEdit, canComment } from "@/lib/boards";
import { normalizePriority } from "@/lib/priority";
import { normalizeStatus, STATUSES } from "@/lib/status";
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
  if (!canEdit(role)) throw new Error("Ваша роль на доске не позволяет редактировать");

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
  if (!canEdit(role)) throw new Error("Ваша роль на доске не позволяет удалять");

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

/**
 * Combine a date (yyyy-mm-dd) with an optional time (HH:mm) into an instant.
 * Interpreted as UTC wall-clock to match the app's date-only convention
 * (`new Date("yyyy-mm-dd")` is already UTC midnight). No time → UTC midnight,
 * which downstream code treats as "date only".
 */
function parseDateTime(
  dateVal: FormDataEntryValue | null,
  timeVal: FormDataEntryValue | null,
): Date | null {
  const d = typeof dateVal === "string" ? dateVal.trim() : "";
  if (!d) return null;
  const t = typeof timeVal === "string" ? timeVal.trim() : "";
  return t ? new Date(`${d}T${t}:00Z`) : new Date(`${d}T00:00:00Z`);
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
  statusKey: string | null;
};

/** Guess a column's task status from its position/title. */
function statusForColumn(
  title: string,
  order: number,
  isLast: boolean,
  systemKey: string | null,
): string {
  if (systemKey === "COMPLETED") return "done";
  const t = title.toLowerCase();
  if (/готов|сделано|закрыт|опубликов|принят/.test(t)) return "done";
  if (/бэклог|идеи|новые|отклик|когда/.test(t)) return "backlog";
  if (order === 0) return "todo";
  if (isLast) return "done";
  return "in_progress";
}

/**
 * Columns for a freshly created board: from a template if a valid id is given,
 * otherwise the default set. Always guarantees the "Завершённые задачи" column,
 * and assigns each column a linked task status.
 */
async function columnsForNewBoard(templateId: string): Promise<NewColumn[]> {
  let raw: { title: string; isSystem: boolean; systemKey: string | null }[] | null = null;

  if (templateId) {
    const tpl = await prisma.boardTemplate.findUnique({
      where: { id: templateId },
      include: { columns: { orderBy: { order: "asc" } } },
    });
    if (tpl && tpl.columns.length) {
      raw = tpl.columns.map((c) => ({
        title: c.title,
        isSystem: c.isSystem,
        systemKey: c.systemKey,
      }));
    }
  }

  if (!raw) {
    raw = DEFAULT_COLUMNS.map((title) => ({ title, isSystem: false, systemKey: null }));
  }

  if (!raw.some((c) => c.systemKey === "COMPLETED")) {
    raw.push({ title: "Завершённые задачи", isSystem: true, systemKey: "COMPLETED" });
  }

  const lastActive = raw.filter((c) => c.systemKey !== "COMPLETED").length - 1;
  return raw.map((c, i) => ({
    ...c,
    order: i,
    statusKey: statusForColumn(c.title, i, i === lastActive, c.systemKey),
  }));
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

/** Archive a board — hides it from lists/sidebar without deleting anything. */
export async function archiveBoard(boardId: string) {
  const { user } = await requireBoardOwner(boardId);
  await requirePerm(user, PERMS.BOARD_EDIT);
  await prisma.board.update({
    where: { id: boardId },
    data: { archivedAt: new Date() },
  });
  bump(boardId);
  revalidatePath("/boards");
}

/** Restore an archived board back into active lists. */
export async function unarchiveBoard(boardId: string) {
  const { user } = await requireBoardOwner(boardId);
  await requirePerm(user, PERMS.BOARD_EDIT);
  await prisma.board.update({
    where: { id: boardId },
    data: { archivedAt: null },
  });
  bump(boardId);
  revalidatePath("/boards");
}

/** Create a ready-to-explore starter board for onboarding. */
export async function createStarterBoard(): Promise<{ boardId: string }> {
  const user = await requireUser();
  await requirePerm(user, PERMS.BOARD_CREATE);
  const board = await prisma.board.create({
    data: {
      title: "Мой первый проект",
      color: "#0ea5e9",
      isPersonal: true,
      ownerId: user.id,
      columns: {
        create: [
          { title: "К работе", order: 0 },
          { title: "В процессе", order: 1 },
          { title: "Готово", order: 2 },
          {
            title: "Завершённые задачи",
            order: 3,
            isSystem: true,
            systemKey: "COMPLETED",
          },
        ],
      },
    },
    include: { columns: true },
  });
  const todo = board.columns.find((c) => c.order === 0)?.id ?? board.columns[0].id;
  const samples = [
    "👋 Изучите доску — перетащите эту карточку",
    "Создайте свою задачу (кнопка «Добавить задачу» или ⌘K)",
    "Назначьте исполнителя в карточке задачи",
  ];
  for (let i = 0; i < samples.length; i++) {
    await prisma.task.create({
      data: {
        boardId: board.id,
        columnId: todo,
        title: samples[i],
        order: i,
        createdById: user.id,
      },
    });
  }
  revalidatePath("/boards");
  revalidatePath("/dashboard");
  return { boardId: board.id };
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
  role: "EDITOR" | "COMMENTER" | "VIEWER",
) {
  const { user } = await requireBoardOwner(boardId);
  await requirePerm(user, PERMS.BOARD_MANAGE_MEMBERS);
  // On a personal board this invites the user; on a shared board it overrides
  // their default Editor role (e.g. to Commenter/Viewer).
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
  const name = title.trim() || "Новая колонка";
  await prisma.column.create({
    data: {
      boardId,
      title: name,
      order: count,
      statusKey: statusForColumn(name, count, false, null),
    },
  });
  bump(boardId);
}

/** Set a column's linked task status; re-syncs the status of tasks inside it. */
export async function setColumnStatus(columnId: string, statusKey: string) {
  const col = await prisma.column.findUnique({
    where: { id: columnId },
    select: { boardId: true },
  });
  if (!col) return;
  const user = await requireBoardEditor(col.boardId);
  await requirePerm(user, PERMS.COLUMN_EDIT);
  if (!STATUSES.includes(statusKey as never)) return;
  await prisma.$transaction([
    prisma.column.update({ where: { id: columnId }, data: { statusKey } }),
    prisma.task.updateMany({ where: { columnId }, data: { status: statusKey } }),
  ]);
  bump(col.boardId);
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

/** Create a task in a board's first non-system column (used by ⌘K quick-add). */
export async function quickCreateTask(
  boardId: string,
  title: string,
): Promise<{ taskId: string } | null> {
  const user = await requireBoardEditor(boardId);
  await requirePerm(user, PERMS.TASK_CREATE);
  const trimmed = title.trim();
  if (!trimmed) return null;
  const col = await prisma.column.findFirst({
    where: { boardId, systemKey: null },
    orderBy: { order: "asc" },
  });
  if (!col) return null;
  const count = await prisma.task.count({ where: { columnId: col.id } });
  const task = await prisma.task.create({
    data: {
      boardId,
      columnId: col.id,
      title: trimmed,
      order: count,
      createdById: user.id,
    },
  });
  await logHistory(task.id, user.id, "created", { after: task.title });
  bump(boardId);
  return { taskId: task.id };
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
      dueDate: parseDateTime(formData.get("dueDate"), formData.get("dueTime")),
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
  // Keep the original time-of-day on the rolled occurrence.
  if (next && task.dueDate) {
    next.setUTCHours(
      task.dueDate.getUTCHours(),
      task.dueDate.getUTCMinutes(),
      task.dueDate.getUTCSeconds(),
      0,
    );
  }

  await prisma.task.update({
    where: { id: taskId },
    // No more occurrences → stop the recurrence but keep the task.
    data: next ? { dueDate: next } : { recurFreq: null },
  });
  // Fresh round → drop previous confirmations.
  await prisma.taskAssignee.updateMany({
    where: { taskId },
    data: { confirmed: false },
  });
  await logHistory(taskId, user.id, "recurred", {
    after: next ? next.toISOString().slice(0, 10) : null,
  });
  bump(boardId);
  return { next: next ? next.toISOString().slice(0, 10) : null };
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
    select: { boardId: true, systemKey: true, statusKey: true },
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
        recurFreq: true,
        recurInterval: true,
        recurDays: true,
        recurUntil: true,
        dueDate: true,
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

    // Recurring task: don't archive — reschedule to the next occurrence and
    // reset confirmations, leaving it active for the next round.
    const rule = ruleFromTask({
      recurFreq: task.recurFreq,
      recurInterval: task.recurInterval,
      recurDays: task.recurDays,
      recurUntil: task.recurUntil ? task.recurUntil.toISOString().slice(0, 10) : null,
    });
    if (rule) {
      const now = new Date();
      const today = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const due = task.dueDate ?? today;
      const base = due > today ? due : today;
      const next = nextOccurrence(rule, base);
      // Keep the original time-of-day on the rolled occurrence.
      if (next && task.dueDate) {
        next.setUTCHours(
          task.dueDate.getUTCHours(),
          task.dueDate.getUTCMinutes(),
          task.dueDate.getUTCSeconds(),
          0,
        );
      }
      await prisma.task.update({
        where: { id: taskId },
        // Roll to the next occurrence (or stop if exhausted); keep it active.
        data: next ? { dueDate: next } : { recurFreq: null },
      });
      // Reset confirmations so the next round starts fresh.
      await prisma.taskAssignee.updateMany({
        where: { taskId },
        data: { confirmed: false },
      });
      await logHistory(taskId, user.id, "recurred", {
        after: next ? next.toISOString().slice(0, 10) : null,
      });
      bump(boardId);
      return;
    }
  }

  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      // Moving a card adopts the destination column's status (status ↔ columns).
      data: {
        columnId: toColumnId,
        ...(col.statusKey ? { status: col.statusKey } : {}),
      },
    }),
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
  if (!canComment(role)) return { error: "Наблюдатель не может комментировать" };
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

/** Add/remove an emoji reaction on a comment (any board member). */
export async function toggleCommentReaction(commentId: string, emoji: string) {
  const user = await requireUser();
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { task: { select: { boardId: true } } },
  });
  if (!comment) return;
  if (!canComment(await getBoardRole(comment.task.boardId, user.id))) return;

  const key = { commentId_userId_emoji: { commentId, userId: user.id, emoji } };
  const existing = await prisma.commentReaction.findUnique({ where: key });
  if (existing) {
    await prisma.commentReaction.delete({ where: key });
  } else {
    await prisma.commentReaction.create({ data: { commentId, userId: user.id, emoji } });
  }
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

// ── attachments ───────────────────────────────────────────────────

export async function addTaskAttachment(
  taskId: string,
  url: string,
  name: string,
  size: number,
  mimeType: string,
): Promise<{ id: string } | null> {
  const boardId = await boardIdOfTask(taskId);
  if (!boardId) return null;
  const user = await requireUser();
  const role = await getBoardRole(boardId, user.id);
  if (!role) throw new Error("Нет доступа");
  if (!(await hasPerm(user.id, user.role, PERMS.FILE_UPLOAD))) {
    throw new Error("Недостаточно прав");
  }
  const att = await prisma.taskAttachment.create({
    data: { taskId, userId: user.id, url, name: name.slice(0, 200), size, mimeType },
    select: { id: true },
  });
  await logHistory(taskId, user.id, "attachment_add", { after: name });
  bump(boardId);
  return { id: att.id };
}

export async function deleteTaskAttachment(attachmentId: string) {
  const user = await requireUser();
  const att = await prisma.taskAttachment.findUnique({
    where: { id: attachmentId },
    select: { userId: true, task: { select: { boardId: true } } },
  });
  if (!att) return;
  if (att.userId !== user.id && user.role !== "ADMIN") {
    throw new Error("Удалить вложение может только автор или администратор");
  }
  await prisma.taskAttachment.delete({ where: { id: attachmentId } });
  bump(att.task.boardId);
}

// ── time tracking ─────────────────────────────────────────────────

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
