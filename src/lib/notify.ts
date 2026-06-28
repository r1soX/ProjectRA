import "server-only";
import { prisma } from "./prisma";
import { publishUser } from "./realtime";
import { canAccessChannel } from "./chat";

export type NotifType =
  | "mention_comment"
  | "mention_message"
  | "deadline"
  | "task_assigned"
  | "task_completed"
  | "task_moved";

export interface NotifPayload {
  taskId?: string;
  taskTitle?: string;
  boardId?: string;
  boardTitle?: string;
  fromName?: string;
  columnTitle?: string;
  channelId?: string;
  daysLeft?: number;
  dueTime?: string; // HH:mm when the deadline has a specific time
}

export async function createNotification(
  userId: string,
  type: NotifType,
  payload: NotifPayload,
  link?: string,
) {
  const n = await prisma.notification.create({
    data: {
      userId,
      type,
      payload: JSON.stringify(payload),
      link: link ?? null,
    },
  });

  // Push via SSE (notification-center listens to /api/notifications/stream)
  publishUser(userId, {
    type: "notification",
    notificationId: n.id,
    notifType: type,
    payload,
    link,
  } as never);

  return n;
}

/** Parse @username mentions from text. Returns unique usernames. */
export function parseMentions(text: string): string[] {
  const matches = text.match(/@([\w.]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

/** Notify mentioned users from a comment. */
export async function notifyMentions(
  text: string,
  authorId: string,
  authorName: string,
  taskId: string,
  taskTitle: string,
  boardId: string,
  commentId?: string,
) {
  const usernames = parseMentions(text);
  if (!usernames.length) return;

  const users = await prisma.user.findMany({
    where: { username: { in: usernames }, id: { not: authorId } },
    select: { id: true },
  });
  if (!users.length) return;

  // Only notify people who can actually see this task — a personal task is
  // private to its creator, and a personal board only to its owner/members.
  const [board, task] = await Promise.all([
    prisma.board.findUnique({
      where: { id: boardId },
      select: { isPersonal: true, ownerId: true, members: { select: { userId: true } } },
    }),
    prisma.task.findUnique({
      where: { id: taskId },
      select: { isPersonal: true, createdById: true },
    }),
  ]);
  if (!board || !task) return;
  const memberIds = new Set(board.members.map((m) => m.userId));
  const canSee = (userId: string) =>
    task.isPersonal
      ? userId === task.createdById
      : !board.isPersonal || userId === board.ownerId || memberIds.has(userId);

  const link = `/boards/${boardId}?task=${taskId}${
    commentId ? `&comment=${commentId}` : ""
  }`;

  await Promise.all(
    users
      .filter((u) => canSee(u.id))
      .map((u) =>
        createNotification(
          u.id,
          "mention_comment",
          { taskId, taskTitle, boardId, fromName: authorName },
          link,
        ),
      ),
  );
}

/** Notify mentioned users from a message. */
export async function notifyMentionsInMessage(
  text: string,
  authorId: string,
  authorName: string,
  channelId: string,
  channelTitle: string,
) {
  const usernames = parseMentions(text);
  if (!usernames.length) return;

  const users = await prisma.user.findMany({
    where: { username: { in: usernames }, id: { not: authorId } },
    select: { id: true },
  });
  if (!users.length) return;

  // Only notify people who are part of this channel (a DM has just its two
  // participants; a board channel only the board's members).
  const access = await Promise.all(
    users.map(async (u) => ({
      id: u.id,
      ok: await canAccessChannel(channelId, u.id),
    })),
  );

  await Promise.all(
    access
      .filter((a) => a.ok)
      .map((a) =>
        createNotification(
          a.id,
          "mention_message",
          { channelId, fromName: authorName, taskTitle: channelTitle },
          `/messages?c=${channelId}`,
        ),
      ),
  );
}

/** Notify assignees when they are added to a task. */
export async function notifyAssigned(
  assigneeId: string,
  assignedByName: string,
  taskId: string,
  taskTitle: string,
  boardId: string,
) {
  await createNotification(
    assigneeId,
    "task_assigned",
    { taskId, taskTitle, boardId, fromName: assignedByName },
    `/boards/${boardId}?task=${taskId}`,
  );
}

/** Check all tasks with upcoming/overdue deadlines and send notifications. */
export async function checkDeadlines() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  // Tasks due today or tomorrow, not yet notified today
  const todayStr = now.toISOString().slice(0, 10);

  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { lte: tomorrow },
      // Exclude only the "Completed" system column. Working columns have a NULL
      // systemKey, and Prisma's `{ not: "COMPLETED" }` would drop NULL rows too
      // (SQL `<>` excludes NULL) — so spell out the NULL-safe condition.
      column: {
        OR: [{ systemKey: null }, { systemKey: { not: "COMPLETED" } }],
      },
      OR: [
        { deadlineNotifiedAt: null },
        { deadlineNotifiedAt: { lt: new Date(todayStr) } },
      ],
    },
    include: {
      assignees: { select: { userId: true } },
      createdBy: { select: { id: true } },
      board: { select: { id: true, title: true } },
    },
  });

  for (const task of tasks) {
    if (!task.dueDate) continue;
    // Due dates are date-only (stored at UTC midnight). Compare calendar days in
    // UTC so a task due *today* reads as 0 (not a fractional negative), matching
    // how the rest of the app reasons about dates.
    const due = new Date(task.dueDate);
    const dueMid = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
    const nowMid = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const daysLeft = Math.round((dueMid - nowMid) / (1000 * 60 * 60 * 24));
    // Include a specific time in the reminder when the deadline has one.
    const hasTime =
      due.getUTCHours() !== 0 ||
      due.getUTCMinutes() !== 0 ||
      due.getUTCSeconds() !== 0;
    const dueTime = hasTime
      ? `${String(due.getUTCHours()).padStart(2, "0")}:${String(due.getUTCMinutes()).padStart(2, "0")}`
      : undefined;

    const recipients = [
      ...task.assignees.map((a) => a.userId),
      task.createdBy.id,
    ];
    const uniqueRecipients = [...new Set(recipients)];

    for (const userId of uniqueRecipients) {
      await createNotification(
        userId,
        "deadline",
        {
          taskId: task.id,
          taskTitle: task.title,
          boardId: task.board.id,
          boardTitle: task.board.title,
          daysLeft,
          dueTime,
        },
        `/boards/${task.board.id}?task=${task.id}`,
      );
    }

    await prisma.task.update({
      where: { id: task.id },
      data: { deadlineNotifiedAt: now },
    });
  }
}
