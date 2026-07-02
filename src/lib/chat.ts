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
    avatar: true,
    avatarEmoji: true,
    lastSeenAt: true,
  },
} as const;

/** True if the user has the ADMIN role (god mode — reads every conversation). */
async function isAdminUser(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return u?.role === "ADMIN";
}

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
  if (ch.members.some((m) => m.userId === userId)) return true;
  // Admins (god mode) may read any conversation, including others' DMs.
  return await isAdminUser(userId);
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
    ok =
      channel.members.some((m) => m.userId === userId) ||
      (await isAdminUser(userId));
  }
  return ok ? channel : null;
}

/**
 * Every 1:1 DM channel in the app — the admin's surveillance list. Each entry
 * carries both participants so the UI can label it "A ↔ B".
 */
export async function getAllDmChannels() {
  return prisma.channel.findMany({
    where: { type: "DM" },
    orderBy: { createdAt: "desc" },
    include: { members: { include: { user: userPick } } },
  });
}

/** Unread message counts for the current user, grouped by DM user and board. */
export async function getUnread(meId: string) {
  const [dmChannels, boards] = await Promise.all([
    prisma.channel.findMany({
      where: { type: "DM", members: { some: { userId: meId } } },
      select: { id: true, members: { select: { userId: true } } },
    }),
    getUserBoards(meId),
  ]);
  const boardChannels = await prisma.channel.findMany({
    where: { type: "BOARD", boardId: { in: boards.map((b) => b.id) } },
    select: { id: true, boardId: true },
  });

  const allIds = [
    ...dmChannels.map((c) => c.id),
    ...boardChannels.map((c) => c.id),
  ];
  const byUser: Record<string, number> = {};
  const byBoard: Record<string, number> = {};
  if (allIds.length === 0) return { byUser, byBoard, total: 0 };

  const reads = await prisma.channelRead.findMany({
    where: { userId: meId, channelId: { in: allIds } },
    select: { channelId: true, lastReadAt: true },
  });
  const readMap = new Map(reads.map((r) => [r.channelId, r.lastReadAt]));

  const unreadFor = (channelId: string) => {
    const lastReadAt = readMap.get(channelId);
    return prisma.message.count({
      where: {
        channelId,
        userId: { not: meId },
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });
  };

  let total = 0;
  await Promise.all([
    ...dmChannels.map(async (c) => {
      const other = c.members.find((m) => m.userId !== meId)?.userId;
      if (!other) return;
      const n = await unreadFor(c.id);
      if (n > 0) {
        byUser[other] = n;
        total += n;
      }
    }),
    ...boardChannels.map(async (c) => {
      if (!c.boardId) return;
      const n = await unreadFor(c.id);
      if (n > 0) {
        byBoard[c.boardId] = n;
        total += n;
      }
    }),
  ]);

  return { byUser, byBoard, total };
}

export async function getUnreadTotal(meId: string) {
  return (await getUnread(meId)).total;
}

/** Mark a channel as read up to now for the user. */
export async function markChannelRead(channelId: string, userId: string) {
  const now = new Date();
  await prisma.channelRead.upsert({
    where: { channelId_userId: { channelId, userId } },
    create: { channelId, userId, lastReadAt: now },
    update: { lastReadAt: now },
  });
}

/** Users that should be notified about a new message in this channel. */
export async function recipientsOfChannel(
  channelId: string,
  exceptUserId: string,
) {
  const ch = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      type: true,
      boardId: true,
      members: { select: { userId: true } },
    },
  });
  if (!ch) return [];

  if (ch.type !== "BOARD") {
    return ch.members.map((m) => m.userId).filter((id) => id !== exceptUserId);
  }
  if (!ch.boardId) return [];
  const board = await prisma.board.findUnique({
    where: { id: ch.boardId },
    select: { ownerId: true, members: { select: { userId: true } } },
  });
  if (!board) return [];
  const ids = new Set<string>([
    board.ownerId,
    ...board.members.map((m) => m.userId),
  ]);
  ids.delete(exceptUserId);
  return [...ids];
}

/** Sidebar data: people to DM + boards to chat in. */
export async function getConversationList(meId: string, isAdmin = false) {
  const [users, boards] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, id: { not: meId } },
      orderBy: { lastName: "asc" },
      select: userPick.select,
    }),
    getUserBoards(meId, isAdmin),
  ]);
  return { users, boards };
}
