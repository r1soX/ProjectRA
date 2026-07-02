import "server-only";
import { prisma } from "./prisma";
import { userHasPerm, PERMS } from "./permissions";

export type BoardRole = "OWNER" | "EDITOR" | "COMMENTER" | "VIEWER";

/**
 * Boards visible to the user:
 *  - every shared (non-personal) board,
 *  - personal boards they own,
 *  - personal boards they were invited to.
 *
 * With BOARD_VIEW_ALL (god mode) the user sees every board, including other
 * people's personal ones.
 */
export async function getUserBoards(userId: string, viewAll = false) {
  return prisma.board.findMany({
    where: {
      archivedAt: null,
      ...(viewAll
        ? {}
        : {
            OR: [
              { isPersonal: false },
              { ownerId: userId },
              { members: { some: { userId } } },
            ],
          }),
    },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { tasks: true, columns: true } },
      owner: { select: { id: true, lastName: true, firstName: true } },
    },
  });
}

/**
 * Archived boards the user owns (only a board's owner manages its archive).
 * With BOARD_VIEW_ALL the user sees every archived board (to restore any).
 */
export async function getArchivedBoards(userId: string, viewAll = false) {
  return prisma.board.findMany({
    where: { archivedAt: { not: null }, ...(viewAll ? {} : { ownerId: userId }) },
    orderBy: { archivedAt: "desc" },
    include: {
      _count: { select: { tasks: true, columns: true } },
      owner: { select: { id: true, lastName: true, firstName: true } },
    },
  });
}

const userPick = {
  select: {
    id: true,
    username: true,
    lastName: true,
    firstName: true,
    middleName: true,
    avatar: true,
    avatarEmoji: true,
  },
} as const;

/** Full board data + the requesting user's role, or null if no access. */
export async function getBoardWithData(
  boardId: string,
  userId: string,
  opts: { viewAll?: boolean; manageAll?: boolean; viewAllTasks?: boolean } = {},
) {
  const { viewAll = false, manageAll = false, viewAllTasks = false } = opts;
  // Personal tasks are visible only to their creator, unless TASK_VIEW_ALL.
  const taskWhere = viewAllTasks
    ? {}
    : { OR: [{ isPersonal: false }, { createdById: userId }] };

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      owner: userPick,
      members: { include: { user: userPick } },
      labels: true,
      links: {
        select: {
          sourceTaskId: true,
          targetTaskId: true,
          type: true,
        },
      },
      columns: {
        orderBy: { order: "asc" },
        include: {
          tasks: {
            where: taskWhere,
            orderBy: { order: "asc" },
            include: {
              createdBy: userPick,
              assignees: { include: { user: userPick } },
              labels: { include: { label: true } },
              comments: {
                orderBy: { createdAt: "asc" },
                include: {
                  user: userPick,
                  reactions: { select: { emoji: true, userId: true } },
                },
              },
              subtasks: {
                select: { column: { select: { systemKey: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!board) return null;

  const isOwner = board.ownerId === userId;
  const member = board.members.find((m) => m.userId === userId);
  // Personal boards require membership; shared boards are open to everyone.
  // A global viewer/manager may still enter any personal board.
  if (!isOwner && board.isPersonal && !member && !viewAll && !manageAll)
    return null;

  // A BoardMember row on a shared board acts as a role override (e.g. downgrade
  // someone to Viewer/Commenter); without one, shared boards default to Editor.
  // BOARD_MANAGE_ALL grants Owner anywhere; BOARD_VIEW_ALL alone is read-only
  // on personal boards the user isn't part of.
  const role: BoardRole = isOwner
    ? "OWNER"
    : member
      ? (member.role as BoardRole)
      : manageAll
        ? "OWNER"
        : board.isPersonal
          ? "VIEWER"
          : "EDITOR";
  return { board, role };
}

/** Throws/returns null helpers for actions. Returns role or null. */
export async function getBoardRole(
  boardId: string,
  userId: string,
): Promise<BoardRole | null> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      ownerId: true,
      isPersonal: true,
      members: { where: { userId }, select: { role: true } },
    },
  });
  if (!board) return null;
  if (board.ownerId === userId) return "OWNER";
  const m = board.members[0];
  if (m) return m.role as BoardRole; // explicit (or overridden) role
  if (!board.isPersonal) return "EDITOR"; // shared default → editor
  // Personal board, not a member: only BOARD_MANAGE_ALL grants access (Owner).
  return (await userHasPerm(userId, PERMS.BOARD_MANAGE_ALL)) ? "OWNER" : null;
}

export function canEdit(role: BoardRole | null): boolean {
  return role === "OWNER" || role === "EDITOR";
}

/** Viewers can't comment; everyone else (owner/editor/commenter) can. */
export function canComment(role: BoardRole | null): boolean {
  return role === "OWNER" || role === "EDITOR" || role === "COMMENTER";
}

/** Make sure the board has its protected "Завершённые задачи" column. */
export async function ensureCompletedColumn(boardId: string) {
  const existing = await prisma.column.findFirst({
    where: { boardId, systemKey: "COMPLETED" },
    select: { id: true },
  });
  if (existing) return;
  const max = await prisma.column.aggregate({
    where: { boardId },
    _max: { order: true },
  });
  await prisma.column.create({
    data: {
      boardId,
      title: "Завершённые задачи",
      order: (max._max.order ?? -1) + 1,
      isSystem: true,
      systemKey: "COMPLETED",
    },
  });
}
