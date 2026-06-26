import "server-only";
import { prisma } from "./prisma";

export type BoardRole = "OWNER" | "EDITOR" | "VIEWER";

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
  },
} as const;

/** Full board data + the requesting user's role, or null if no access. */
export async function getBoardWithData(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      owner: userPick,
      members: { include: { user: userPick } },
      labels: true,
      columns: {
        orderBy: { order: "asc" },
        include: {
          tasks: {
            orderBy: { order: "asc" },
            include: {
              createdBy: userPick,
              assignees: { include: { user: userPick } },
              labels: { include: { label: true } },
              comments: {
                orderBy: { createdAt: "asc" },
                include: { user: userPick },
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
  // Shared boards are accessible (and editable) by everyone.
  if (!isOwner && board.isPersonal && !member) return null;

  const role: BoardRole = isOwner
    ? "OWNER"
    : board.isPersonal
      ? (member!.role as BoardRole)
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
  if (!board.isPersonal) return "EDITOR"; // shared → everyone can edit
  const m = board.members[0];
  return m ? (m.role as BoardRole) : null;
}

export function canEdit(role: BoardRole | null): boolean {
  return role === "OWNER" || role === "EDITOR";
}
