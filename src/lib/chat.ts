import "server-only";
import { prisma } from "./prisma";
import { getBoardRole, getUserBoards } from "./boards";

const userPick = {
  select: {
    id: true,
    username: true,
    lastName: true,
    firstName: true,
    middleName: true,
  },
} as const;

/** Find (or create) the 1:1 DM channel between two users. */
export async function ensureDmChannel(meId: string, otherId: string) {
  if (meId === otherId) return null;
  const existing = await prisma.channel.findFirst({
    where: {
      type: "DM",
      AND: [
        { members: { some: { userId: meId } } },
        { members: { some: { userId: otherId } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const channel = await prisma.channel.create({
    data: {
      type: "DM",
      name: "DM",
      members: { create: [{ userId: meId }, { userId: otherId }] },
    },
    select: { id: true },
  });
  return channel.id;
}

/** Find (or create) the chat channel for a board the user can access. */
export async function ensureBoardChannel(boardId: string, userId: string) {
  const role = await getBoardRole(boardId, userId);
  if (!role) return null;

  const existing = await prisma.channel.findFirst({
    where: { type: "BOARD", boardId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { title: true },
  });
  const channel = await prisma.channel.create({
    data: { type: "BOARD", boardId, name: board?.title ?? "Доска" },
    select: { id: true },
  });
  return channel.id;
}

/** True if the user may read/post in this channel. */
export async function canAccessChannel(channelId: string, userId: string) {
  const ch = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      type: true,
      boardId: true,
      members: { select: { userId: true } },
    },
  });
  if (!ch) return false;
  if (ch.type === "BOARD" && ch.boardId) {
    return (await getBoardRole(ch.boardId, userId)) != null;
  }
  return ch.members.some((m) => m.userId === userId);
}

/** Full channel data (with messages) if the user has access, else null. */
export async function getChannelView(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      board: { select: { id: true, title: true, color: true } },
      members: { include: { user: userPick } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 300,
        include: { user: userPick },
      },
    },
  });
  if (!channel) return null;

  let ok = false;
  if (channel.type === "BOARD" && channel.boardId) {
    ok = (await getBoardRole(channel.boardId, userId)) != null;
  } else {
    ok = channel.members.some((m) => m.userId === userId);
  }
  return ok ? channel : null;
}

/** Sidebar data: people to DM + boards to chat in. */
export async function getConversationList(meId: string) {
  const [users, boards] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, id: { not: meId } },
      orderBy: { lastName: "asc" },
      select: userPick.select,
    }),
    getUserBoards(meId),
  ]);
  return { users, boards };
}
