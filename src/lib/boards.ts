import "server-only";
import { prisma } from "./prisma";

export type BoardRole = "OWNER" | "EDITOR" | "COMMENTER" | "VIEWER";

/**
 * Boards visible to the user:
 *  - every shared (non-personal) board,
 *  - personal boards they own,
 *  - personal boards they were invited to.
 */
export async function getUserBoards(userId: string) {
  return prisma.board.findMany({
    where: {
      OR: [
        { isPersonal: false },
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    orderBy: { createdAt: "asc" },
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
  isAdmin = false,
) {
  // Personal tasks are visible only to their creator (and admins).
  const taskWhere = isAdmin
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
  if (!isOwner && board.isPersonal && !member) return null;

  // A BoardMember row on a shared board acts as a role override (e.g. downgrade
  // someone to Viewer/Commenter); without one, shared boards default to Editor.
  const role: BoardRole = isOwner
    ? "OWNER"
    : member
      ? (member.role as BoardRole)
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
  return board.isPersonal ? null : "EDITOR"; // shared default → editor
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
