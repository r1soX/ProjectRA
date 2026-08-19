import "server-only";

import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { getUserBoards } from "@/lib/boards";
import { shortName } from "@/lib/names";
import { notifyAssigned, notifyMentions } from "@/lib/notify";
import { hasPerm, PERMS, type PermKey } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizePriority, PRIORITY_META } from "@/lib/priority";
import { publishBoard } from "@/lib/realtime";
import { nextOccurrence, ruleFromTask } from "@/lib/recurrence";
import { normalizeStatus } from "@/lib/status";
import { getStatuses, statusKeySet, statusLabel } from "@/lib/statuses";
import { logHistory } from "@/lib/task-history";
import type { AgentRequest } from "./contracts";
import {
  agentRoleCanComment,
  agentRoleCanEdit,
  canAgentEditTask,
  canAgentReadTask,
  resolveAgentBoardRole,
  type AgentBoardRole,
} from "./policy";

export class AgentServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const denied = (message = "Недостаточно прав для этой операции.") =>
  new AgentServiceError("FORBIDDEN", message, 403);
const hidden = (resource: "Проект" | "Задача") =>
  new AgentServiceError(
    "NOT_FOUND",
    `${resource} не найден или недоступен текущему пользователю.`,
    404,
  );
const conflict = (message: string) =>
  new AgentServiceError("CONFLICT", message, 409);

type BoardContext = {
  id: string;
  title: string;
  ownerId: string;
  isPersonal: boolean;
  role: AgentBoardRole;
};

type TaskContext = {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  createdById: string;
  isPersonal: boolean;
  board: BoardContext;
};

const userSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  middleName: true,
} as const;

function displayName(user: { firstName: string; lastName: string; middleName?: string | null }) {
  return [user.lastName, user.firstName, user.middleName].filter(Boolean).join(" ");
}

function userView(user: { id: string; username: string; firstName: string; lastName: string; middleName?: string | null }) {
  return { id: user.id, username: user.username, displayName: displayName(user) };
}

function dateValue(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function parseDate(value: string | null | undefined) {
  return value == null ? null : new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
}

function compactTask(task: {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  isPersonal: boolean;
  startDate: Date | null;
  dueDate: Date | null;
  updatedAt: Date;
  board: { id: string; title: string };
  column: { id: string; title: string; systemKey?: string | null };
  createdBy: { id: string; username: string; firstName: string; lastName: string; middleName?: string | null };
  assignees: Array<{ confirmed: boolean; user: { id: string; username: string; firstName: string; lastName: string; middleName?: string | null } }>;
}) {
  return {
    id: task.id,
    title: task.title,
    ...(task.description !== undefined ? { description: task.description } : {}),
    priority: task.priority,
    status: task.status,
    isPersonal: task.isPersonal,
    startDate: dateValue(task.startDate),
    dueDate: dateValue(task.dueDate),
    updatedAt: task.updatedAt.toISOString(),
    project: task.board,
    column: task.column,
    creator: userView(task.createdBy),
    assignees: task.assignees.map((row) => ({ ...userView(row.user), confirmed: row.confirmed })),
  };
}

export class ProjectraAgentService {
  constructor(
    private readonly actor: SessionUser,
    private readonly expiresAt: number,
  ) {}

  private perm(key: PermKey) {
    return hasPerm(this.actor.id, this.actor.role, key);
  }

  private async requirePerm(key: PermKey) {
    if (!(await this.perm(key))) throw denied();
  }

  private async boardContext(boardId: string): Promise<BoardContext> {
    await this.requirePerm(PERMS.BOARD_VIEW);
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        title: true,
        ownerId: true,
        isPersonal: true,
        archivedAt: true,
        members: { where: { userId: this.actor.id }, select: { role: true } },
      },
    });
    if (!board || board.archivedAt) throw hidden("Проект");
    const [canViewAll, canManageAll] = await Promise.all([
      this.perm(PERMS.BOARD_VIEW_ALL),
      this.perm(PERMS.BOARD_MANAGE_ALL),
    ]);
    const role = resolveAgentBoardRole({
      actorId: this.actor.id,
      ownerId: board.ownerId,
      isPersonal: board.isPersonal,
      memberRole: board.members[0]?.role,
      canViewAll,
      canManageAll,
    });
    if (!role) throw hidden("Проект");
    return { id: board.id, title: board.title, ownerId: board.ownerId, isPersonal: board.isPersonal, role };
  }

  private async writableBoard(boardId: string) {
    const board = await this.boardContext(boardId);
    if (!agentRoleCanEdit(board.role)) throw denied("Для изменения проекта нужна роль владельца или редактора.");
    return board;
  }

  private async taskContext(taskId: string): Promise<TaskContext> {
    await this.requirePerm(PERMS.TASK_VIEW);
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, boardId: true, columnId: true, title: true, createdById: true, isPersonal: true },
    });
    if (!task) throw hidden("Задача");
    const board = await this.boardContext(task.boardId);
    const canViewAllTasks = await this.perm(PERMS.TASK_VIEW_ALL);
    if (!canAgentReadTask({
      actorId: this.actor.id,
      createdById: task.createdById,
      isPersonal: task.isPersonal,
      boardRole: board.role,
      canViewAllTasks,
      canEditOwn: false,
      canEditAny: false,
    })) throw hidden("Задача");
    return { ...task, board };
  }

  private async editableTask(taskId: string) {
    const task = await this.taskContext(taskId);
    const [canViewAllTasks, canEditOwn, canEditAny] = await Promise.all([
      this.perm(PERMS.TASK_VIEW_ALL),
      this.perm(PERMS.TASK_EDIT_OWN),
      this.perm(PERMS.TASK_EDIT_ANY),
    ]);
    if (!canAgentEditTask({
      actorId: this.actor.id,
      createdById: task.createdById,
      isPersonal: task.isPersonal,
      boardRole: task.board.role,
      canViewAllTasks,
      canEditOwn,
      canEditAny,
    })) throw denied("Недостаточно прав для изменения этой задачи.");
    return task;
  }

  private async accessibleBoardIds() {
    if (!(await this.perm(PERMS.BOARD_VIEW))) return [] as string[];
    const [viewAll, manageAll] = await Promise.all([
      this.perm(PERMS.BOARD_VIEW_ALL),
      this.perm(PERMS.BOARD_MANAGE_ALL),
    ]);
    const boards = await getUserBoards(this.actor.id, viewAll || manageAll);
    return boards.map((board) => board.id);
  }

  private async taskWhere(projectId?: string): Promise<Prisma.TaskWhereInput> {
    const [boardIds, viewAllTasks] = await Promise.all([
      this.accessibleBoardIds(),
      this.perm(PERMS.TASK_VIEW_ALL),
    ]);
    if (projectId && !boardIds.includes(projectId)) throw hidden("Проект");
    return {
      boardId: projectId ?? { in: boardIds },
      ...(viewAllTasks ? {} : { OR: [{ isPersonal: false }, { createdById: this.actor.id }] }),
    };
  }

  identity() {
    return {
      id: this.actor.id,
      username: this.actor.username,
      displayName: displayName(this.actor),
      role: this.actor.role,
      expiresAt: this.expiresAt,
    };
  }

  async listProjects(input: Extract<AgentRequest, { operation: "list_projects" }>['input']) {
    await this.requirePerm(PERMS.BOARD_VIEW);
    const [canViewAll, canManageAll] = await Promise.all([this.perm(PERMS.BOARD_VIEW_ALL), this.perm(PERMS.BOARD_MANAGE_ALL)]);
    const boards = await getUserBoards(this.actor.id, canViewAll || canManageAll);
    const query = input.query?.toLocaleLowerCase("ru") ?? "";
    const filtered = boards.filter((board) => !query || board.title.toLocaleLowerCase("ru").includes(query)).slice(0, input.limit);
    const memberships = await prisma.boardMember.findMany({
      where: { userId: this.actor.id, boardId: { in: filtered.map((board) => board.id) } },
      select: { boardId: true, role: true },
    });
    const memberRoles = new Map(memberships.map((row) => [row.boardId, row.role]));
    return filtered.map((board) => ({
      id: board.id,
      title: board.title,
      color: board.color,
      isPersonal: board.isPersonal,
      role: resolveAgentBoardRole({ actorId: this.actor.id, ownerId: board.ownerId, isPersonal: board.isPersonal, memberRole: memberRoles.get(board.id), canViewAll, canManageAll }),
      taskCount: board._count.tasks,
      columnCount: board._count.columns,
      updatedAt: board.updatedAt.toISOString(),
    }));
  }

  async getProject(projectId: string) {
    const context = await this.boardContext(projectId);
    const board = await prisma.board.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        id: true, title: true, color: true, isPersonal: true, updatedAt: true,
        owner: { select: userSelect },
        columns: { orderBy: { order: "asc" }, select: { id: true, title: true, order: true, statusKey: true, systemKey: true, _count: { select: { tasks: true } } } },
      },
    });
    const [canCreate, canMove, canAssign, canComment] = await Promise.all([
      this.perm(PERMS.TASK_CREATE), this.perm(PERMS.TASK_MOVE), this.perm(PERMS.TASK_ASSIGN), this.perm(PERMS.COMMENT_CREATE),
    ]);
    return {
      id: board.id, title: board.title, color: board.color, isPersonal: board.isPersonal,
      role: context.role, owner: userView(board.owner), updatedAt: board.updatedAt.toISOString(),
      statuses: await getStatuses(),
      columns: board.columns.map(({ _count, ...column }) => ({ ...column, taskCount: _count.tasks })),
      capabilities: {
        createTask: agentRoleCanEdit(context.role) && canCreate,
        moveTask: agentRoleCanEdit(context.role) && canMove,
        assignTask: agentRoleCanEdit(context.role) && canAssign,
        comment: agentRoleCanComment(context.role) && canComment,
      },
    };
  }

  async listProjectMembers(projectId: string) {
    const board = await this.boardContext(projectId);
    const rows = board.isPersonal
      ? await prisma.user.findMany({
          where: { isActive: true, OR: [{ id: board.ownerId }, { memberships: { some: { boardId: projectId } } }] },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { ...userSelect, memberships: { where: { boardId: projectId }, select: { role: true } } },
        })
      : await prisma.user.findMany({
          where: { isActive: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { ...userSelect, memberships: { where: { boardId: projectId }, select: { role: true } } },
        });
    return rows.map((user) => ({
      ...userView(user),
      boardRole: user.id === board.ownerId ? "OWNER" : (user.memberships[0]?.role ?? (board.isPersonal ? null : "EDITOR")),
    }));
  }

  async searchTasks(input: Extract<AgentRequest, { operation: "search_tasks" }>['input']) {
    await this.requirePerm(PERMS.TASK_VIEW);
    const access = await this.taskWhere(input.projectId);
    const tasks = await prisma.task.findMany({
      where: {
        AND: [access, { OR: [{ title: { contains: input.query, mode: "insensitive" } }, { description: { contains: input.query, mode: "insensitive" } }] }],
        ...(input.assigneeId ? { assignees: { some: { userId: input.assigneeId } } } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.includeCompleted ? {} : { column: { OR: [{ systemKey: null }, { systemKey: { not: "COMPLETED" } }] } }),
      },
      orderBy: { updatedAt: "desc" }, take: input.limit,
      include: { board: { select: { id: true, title: true } }, column: { select: { id: true, title: true, systemKey: true } }, createdBy: { select: userSelect }, assignees: { include: { user: { select: userSelect } } } },
    });
    return tasks.map(compactTask);
  }

  async listMyTasks(input: Extract<AgentRequest, { operation: "list_my_tasks" }>['input']) {
    await this.requirePerm(PERMS.TASK_VIEW);
    const access = await this.taskWhere(input.projectId);
    const tasks = await prisma.task.findMany({
      where: { AND: [access], assignees: { some: { userId: this.actor.id } }, ...(input.includeCompleted ? {} : { column: { OR: [{ systemKey: null }, { systemKey: { not: "COMPLETED" } }] } }) },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }], take: input.limit,
      include: { board: { select: { id: true, title: true } }, column: { select: { id: true, title: true, systemKey: true } }, createdBy: { select: userSelect }, assignees: { include: { user: { select: userSelect } } } },
    });
    return tasks.map(compactTask);
  }

  async getTask(taskId: string, commentsLimit: number) {
    const context = await this.taskContext(taskId);
    const canViewComments = await this.perm(PERMS.COMMENT_VIEW);
    const task = await prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        board: { select: { id: true, title: true } }, column: { select: { id: true, title: true, systemKey: true } },
        createdBy: { select: userSelect }, assignees: { include: { user: { select: userSelect } } },
        comments: { orderBy: { createdAt: "desc" }, take: canViewComments ? commentsLimit : 0, include: { user: { select: userSelect } } },
      },
    });
    const [canEditOwn, canEditAny, canMove, canAssign, canComplete, canCreateComment, canViewAllTasks] = await Promise.all([
      this.perm(PERMS.TASK_EDIT_OWN), this.perm(PERMS.TASK_EDIT_ANY), this.perm(PERMS.TASK_MOVE), this.perm(PERMS.TASK_ASSIGN), this.perm(PERMS.TASK_COMPLETE), this.perm(PERMS.COMMENT_CREATE), this.perm(PERMS.TASK_VIEW_ALL),
    ]);
    const editable = canAgentEditTask({ actorId: this.actor.id, createdById: task.createdById, isPersonal: task.isPersonal, boardRole: context.board.role, canViewAllTasks, canEditOwn, canEditAny });
    return {
      ...compactTask(task),
      comments: [...task.comments].reverse().map((comment) => ({ id: comment.id, body: comment.body, createdAt: comment.createdAt.toISOString(), editedAt: dateValue(comment.editedAt), author: userView(comment.user) })),
      capabilities: {
        edit: editable,
        move: agentRoleCanEdit(context.board.role) && canMove,
        assign: editable && canAssign,
        confirmCompletion: task.assignees.some((row) => row.user.id === this.actor.id),
        complete: agentRoleCanEdit(context.board.role) && canComplete && (this.actor.role === "ADMIN" || task.createdById === this.actor.id),
        comment: agentRoleCanComment(context.board.role) && canCreateComment,
      },
    };
  }

  async createTask(input: Extract<AgentRequest, { operation: "create_task" }>['input']) {
    const board = await this.writableBoard(input.projectId);
    await this.requirePerm(PERMS.TASK_CREATE);
    if (input.isPersonal && input.assigneeIds.some((id) => id !== this.actor.id)) {
      throw conflict("Личную задачу можно назначить только её создателю.");
    }
    const column = input.columnId
      ? await prisma.column.findUnique({ where: { id: input.columnId } })
      : await prisma.column.findFirst({ where: { boardId: input.projectId, systemKey: null }, orderBy: { order: "asc" } });
    if (!column || column.boardId !== input.projectId || column.systemKey === "COMPLETED") {
      throw conflict("Для создания нужна рабочая колонка этого проекта.");
    }
    const assigneeIds = [...new Set(input.assigneeIds)];
    if (assigneeIds.length) {
      await this.requirePerm(PERMS.TASK_ASSIGN);
      const allowed = new Set((await this.listProjectMembers(input.projectId)).map((member) => member.id));
      if (assigneeIds.some((id) => !allowed.has(id))) throw conflict("Один или несколько исполнителей недоступны в этом проекте.");
    }
    const order = await prisma.task.count({ where: { columnId: column.id } });
    const task = await prisma.task.create({
      data: {
        boardId: board.id, columnId: column.id, title: input.title, description: input.description || null,
        priority: normalizePriority(input.priority), isPersonal: input.isPersonal,
        startDate: parseDate(input.startDate), dueDate: parseDate(input.dueDate), order,
        createdById: this.actor.id, status: normalizeStatus(column.statusKey),
        assignees: assigneeIds.length ? { create: assigneeIds.map((userId) => ({ userId })) } : undefined,
      },
      include: { board: { select: { id: true, title: true } }, column: { select: { id: true, title: true, systemKey: true } }, createdBy: { select: userSelect }, assignees: { include: { user: { select: userSelect } } } },
    });
    await logHistory(task.id, this.actor.id, "created", { after: task.title });
    for (const assignee of task.assignees) {
      await logHistory(task.id, this.actor.id, "assignee_add", { name: assignee.userId });
      if (assignee.userId !== this.actor.id) await notifyAssigned(assignee.userId, shortName(this.actor), task.id, task.title, task.boardId);
    }
    publishBoard(board.id);
    return compactTask(task);
  }

  async updateTask(input: Extract<AgentRequest, { operation: "update_task" }>['input']) {
    const context = await this.editableTask(input.taskId);
    const old = await prisma.task.findUniqueOrThrow({ where: { id: input.taskId }, select: { title: true, description: true, priority: true, isPersonal: true, startDate: true, dueDate: true } });
    const data: Prisma.TaskUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description || null;
    if (input.priority !== undefined) data.priority = normalizePriority(input.priority);
    if (input.startDate !== undefined) data.startDate = parseDate(input.startDate);
    if (input.dueDate !== undefined) data.dueDate = parseDate(input.dueDate);
    if (input.isPersonal !== undefined) {
      if (input.isPersonal) {
        const otherAssignees = await prisma.taskAssignee.count({ where: { taskId: input.taskId, userId: { not: this.actor.id } } });
        if (otherAssignees) throw conflict("Сначала снимите с задачи других исполнителей, затем сделайте её личной.");
      }
      data.isPersonal = input.isPersonal;
    }
    const task = await prisma.task.update({ where: { id: input.taskId }, data, include: { board: { select: { id: true, title: true } }, column: { select: { id: true, title: true, systemKey: true } }, createdBy: { select: userSelect }, assignees: { include: { user: { select: userSelect } } } } });
    if (old.title !== task.title) await logHistory(task.id, this.actor.id, "title", { before: old.title, after: task.title });
    if ((old.description ?? "") !== (task.description ?? "")) await logHistory(task.id, this.actor.id, "description");
    if (old.priority !== task.priority) await logHistory(task.id, this.actor.id, "priority", { after: PRIORITY_META[normalizePriority(task.priority)].label });
    if (old.isPersonal !== task.isPersonal) await logHistory(task.id, this.actor.id, "personal", { after: task.isPersonal ? "личная" : "общая" });
    if ((old.startDate?.getTime() ?? null) !== (task.startDate?.getTime() ?? null)) await logHistory(task.id, this.actor.id, "start", { after: dateValue(task.startDate) });
    if ((old.dueDate?.getTime() ?? null) !== (task.dueDate?.getTime() ?? null)) await logHistory(task.id, this.actor.id, "due", { after: dateValue(task.dueDate) });
    publishBoard(context.boardId);
    return compactTask(task);
  }

  async assignTask(taskId: string, userId: string, remove = false) {
    const task = await this.editableTask(taskId);
    await this.requirePerm(PERMS.TASK_ASSIGN);
    if (task.isPersonal && userId !== this.actor.id) throw conflict("Личную задачу можно назначить только её создателю.");
    if (!remove) {
      const allowed = new Set((await this.listProjectMembers(task.boardId)).map((member) => member.id));
      if (!allowed.has(userId)) throw conflict("Пользователь недоступен в этом проекте.");
      const existing = await prisma.taskAssignee.findUnique({ where: { taskId_userId: { taskId, userId } } });
      if (!existing) {
        await prisma.taskAssignee.create({ data: { taskId, userId } });
        await logHistory(taskId, this.actor.id, "assignee_add", { name: userId });
        if (userId !== this.actor.id) await notifyAssigned(userId, shortName(this.actor), taskId, task.title, task.boardId);
      }
    } else {
      const deleted = await prisma.taskAssignee.deleteMany({ where: { taskId, userId } });
      if (deleted.count) await logHistory(taskId, this.actor.id, "assignee_remove", { name: userId });
    }
    publishBoard(task.boardId);
    return { taskId, userId, assigned: !remove };
  }

  async addComment(taskId: string, body: string) {
    const task = await this.taskContext(taskId);
    await this.requirePerm(PERMS.COMMENT_CREATE);
    if (!agentRoleCanComment(task.board.role)) throw denied("Наблюдатель не может комментировать задачи.");
    const comment = await prisma.comment.create({ data: { taskId, userId: this.actor.id, body }, include: { user: { select: userSelect } } });
    await logHistory(taskId, this.actor.id, "comment", { after: body.slice(0, 60) });
    await notifyMentions(body, this.actor.id, shortName(this.actor), taskId, task.title, task.boardId, comment.id);
    publishBoard(task.boardId);
    return { id: comment.id, taskId, body: comment.body, createdAt: comment.createdAt.toISOString(), author: userView(comment.user) };
  }

  private async move(taskId: string, targetColumnId: string) {
    const task = await this.taskContext(taskId);
    await this.requirePerm(PERMS.TASK_MOVE);
    if (!agentRoleCanEdit(task.board.role)) throw denied("Для перемещения задачи нужна роль владельца или редактора.");
    const [column, fullTask] = await Promise.all([
      prisma.column.findUnique({ where: { id: targetColumnId }, select: { id: true, boardId: true, title: true, statusKey: true, systemKey: true } }),
      prisma.task.findUniqueOrThrow({ where: { id: taskId }, select: { columnId: true, statusLocked: true, column: { select: { title: true } }, createdById: true, assignees: { select: { confirmed: true } }, recurFreq: true, recurInterval: true, recurDays: true, recurUntil: true, dueDate: true } }),
    ]);
    if (!column || column.boardId !== task.boardId) throw conflict("Целевая колонка не принадлежит проекту задачи.");
    if (column.systemKey === "COMPLETED") await this.requirePerm(PERMS.TASK_COMPLETE);
    if (column.id === fullTask.columnId) {
      return { taskId, projectId: task.boardId, column: { id: column.id, title: column.title }, completed: column.systemKey === "COMPLETED", unchanged: true };
    }
    if (column.systemKey === "COMPLETED") {
      if (this.actor.role !== "ADMIN" && fullTask.createdById !== this.actor.id) throw denied("Завершить задачу может только её постановщик или администратор.");
      if (fullTask.assignees.some((row) => !row.confirmed)) throw conflict("Не все исполнители подтвердили выполнение задачи.");
      const rule = ruleFromTask({ recurFreq: fullTask.recurFreq, recurInterval: fullTask.recurInterval, recurDays: fullTask.recurDays, recurUntil: fullTask.recurUntil?.toISOString().slice(0, 10) ?? null });
      if (rule) {
        const now = new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const base = fullTask.dueDate && fullTask.dueDate > today ? fullTask.dueDate : today;
        const next = nextOccurrence(rule, base);
        if (next && fullTask.dueDate) next.setUTCHours(fullTask.dueDate.getUTCHours(), fullTask.dueDate.getUTCMinutes(), fullTask.dueDate.getUTCSeconds(), 0);
        await prisma.task.update({ where: { id: taskId }, data: next ? { dueDate: next } : { recurFreq: null } });
        await prisma.taskAssignee.updateMany({ where: { taskId }, data: { confirmed: false } });
        await logHistory(taskId, this.actor.id, "recurred", { after: next?.toISOString().slice(0, 10) ?? null });
        publishBoard(task.boardId);
        return { taskId, recurring: true, nextDueDate: dateValue(next) };
      }
    }
    const order = await prisma.task.count({ where: { columnId: column.id, id: { not: taskId } } });
    await prisma.task.update({
      where: { id: taskId },
      data: { columnId: column.id, order, ...(column.systemKey === "COMPLETED" ? { status: "done" } : !fullTask.statusLocked && column.statusKey ? { status: column.statusKey } : {}) },
    });
    if (fullTask.columnId !== column.id) await logHistory(taskId, this.actor.id, "column", { before: fullTask.column.title, after: column.title });
    if (column.systemKey === "COMPLETED") await logHistory(taskId, this.actor.id, "completed", { after: column.title });
    publishBoard(task.boardId);
    return { taskId, projectId: task.boardId, column: { id: column.id, title: column.title }, completed: column.systemKey === "COMPLETED" };
  }

  async setStatus(taskId: string, status: string) {
    const task = await this.taskContext(taskId);
    await this.requirePerm(PERMS.TASK_MOVE);
    if (!agentRoleCanEdit(task.board.role)) throw denied();
    let nextStatus: string;
    let locked: boolean;
    if (status === "auto") {
      const row = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, select: { column: { select: { statusKey: true, systemKey: true } } } });
      nextStatus = row.column.systemKey === "COMPLETED" ? "done" : normalizeStatus(row.column.statusKey);
      locked = false;
    } else {
      if (!(await statusKeySet()).has(status)) throw conflict("Неизвестный статус задачи.");
      nextStatus = status;
      locked = true;
    }
    await prisma.task.update({ where: { id: taskId }, data: { status: nextStatus, statusLocked: locked } });
    await logHistory(taskId, this.actor.id, "status", { after: await statusLabel(nextStatus) });
    publishBoard(task.boardId);
    return { taskId, status: nextStatus, statusLocked: locked };
  }

  async setMyTaskCompletion(taskId: string, completed: boolean) {
    const task = await this.taskContext(taskId);
    const assignee = await prisma.taskAssignee.findUnique({
      where: { taskId_userId: { taskId, userId: this.actor.id } },
      select: { confirmed: true },
    });
    if (!assignee) {
      throw denied("Отметить выполнение может только назначенный исполнитель.");
    }
    if (assignee.confirmed === completed) {
      return { taskId, userId: this.actor.id, completed, unchanged: true };
    }
    await prisma.taskAssignee.update({
      where: { taskId_userId: { taskId, userId: this.actor.id } },
      data: { confirmed: completed },
    });
    publishBoard(task.boardId);
    return { taskId, userId: this.actor.id, completed, unchanged: false };
  }

  async completeTask(taskId: string) {
    const task = await this.taskContext(taskId);
    const completed = await prisma.column.findFirst({ where: { boardId: task.boardId, systemKey: "COMPLETED" }, select: { id: true } });
    if (!completed) throw conflict("В проекте отсутствует системная колонка завершённых задач.");
    return this.move(taskId, completed.id);
  }

  async projectSummary(projectId: string) {
    const board = await this.boardContext(projectId);
    const access = await this.taskWhere(projectId);
    const tasks = await prisma.task.findMany({
      where: access,
      select: { id: true, title: true, priority: true, status: true, dueDate: true, column: { select: { systemKey: true } }, assignees: { select: { userId: true } } },
    });
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const active = tasks.filter((task) => task.column.systemKey !== "COMPLETED");
    const counts = (key: "status" | "priority") => Object.fromEntries([...new Set(tasks.map((task) => task[key]))].sort().map((value) => [value, tasks.filter((task) => task[key] === value).length]));
    return {
      project: { id: board.id, title: board.title },
      totals: { all: tasks.length, active: active.length, completed: tasks.length - active.length, unassigned: active.filter((task) => task.assignees.length === 0).length, overdue: active.filter((task) => task.dueDate && task.dueDate < now).length, dueWithinSevenDays: active.filter((task) => task.dueDate && task.dueDate >= now && task.dueDate <= inSevenDays).length },
      byStatus: counts("status"), byPriority: counts("priority"),
      overdueTasks: active.filter((task) => task.dueDate && task.dueDate < now).sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime()).slice(0, 10).map((task) => ({ id: task.id, title: task.title, dueDate: dateValue(task.dueDate), priority: task.priority })),
    };
  }

  async execute(request: AgentRequest) {
    switch (request.operation) {
      case "whoami": return this.identity();
      case "list_projects": return this.listProjects(request.input);
      case "get_project": return this.getProject(request.input.projectId);
      case "list_project_members": return this.listProjectMembers(request.input.projectId);
      case "search_tasks": return this.searchTasks(request.input);
      case "get_task": return this.getTask(request.input.taskId, request.input.commentsLimit);
      case "list_my_tasks": return this.listMyTasks(request.input);
      case "create_task": return this.createTask(request.input);
      case "update_task": return this.updateTask(request.input);
      case "assign_task": return this.assignTask(request.input.taskId, request.input.userId);
      case "unassign_task": return this.assignTask(request.input.taskId, request.input.userId, true);
      case "add_task_comment": return this.addComment(request.input.taskId, request.input.body);
      case "move_task": return this.move(request.input.taskId, request.input.targetColumnId);
      case "set_task_status": return this.setStatus(request.input.taskId, request.input.status);
      case "set_my_task_completion": return this.setMyTaskCompletion(request.input.taskId, request.input.completed);
      case "complete_task": return this.completeTask(request.input.taskId);
      case "get_project_summary": return this.projectSummary(request.input.projectId);
    }
  }
}
