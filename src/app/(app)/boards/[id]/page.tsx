import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBoardWithData, ensureCompletedColumn } from "@/lib/boards";
import { shortName, initials, fullName } from "@/lib/names";
import {
  BoardView,
  type BoardColumn,
  type BoardMemberView,
  type DirectoryUser,
} from "./board-view";

const userSelect = {
  id: true,
  username: true,
  lastName: true,
  firstName: true,
  middleName: true,
  avatar: true,
  avatarEmoji: true,
} as const;

type PersonRow = {
  id: string;
  username: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  avatar: string | null;
  avatarEmoji: string | null;
};

function toMemberView(u: PersonRow, role: string): BoardMemberView {
  return {
    userId: u.id,
    role,
    shortName: shortName(u),
    initials: initials(u),
    username: u.username,
    avatar: u.avatar,
    emoji: u.avatarEmoji,
  };
}

function toDateInput(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  await ensureCompletedColumn(id);
  const result = await getBoardWithData(id, user.id, user.role === "ADMIN");
  if (!result) notFound();

  const { board, role } = result;
  const isOwner = role === "OWNER";

  // Assignable people + header members depend on board visibility.
  let assignable: BoardMemberView[];
  let headerMembers: BoardMemberView[];

  if (board.isPersonal) {
    const map = new Map<string, BoardMemberView>();
    map.set(board.owner.id, toMemberView(board.owner, "OWNER"));
    for (const m of board.members) {
      if (!map.has(m.userId)) map.set(m.userId, toMemberView(m.user, m.role));
    }
    assignable = [...map.values()];
    headerMembers = assignable;
  } else {
    const all = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { lastName: "asc" },
      select: userSelect,
    });
    assignable = all.map((u) =>
      toMemberView(u, u.id === board.ownerId ? "OWNER" : "EDITOR"),
    );
    headerMembers = []; // shared board → shown as "доступна всем"
  }

  // Build per-task link lists (so connections are visible on the board).
  const titleById = new Map<string, string>();
  for (const c of board.columns)
    for (const t of c.tasks) titleById.set(t.id, t.title);
  const linksByTask = new Map<
    string,
    { otherTitle: string; type: string; direction: "out" | "in" }[]
  >();
  const pushLink = (
    taskId: string,
    item: { otherTitle: string; type: string; direction: "out" | "in" },
  ) => {
    const arr = linksByTask.get(taskId) ?? [];
    arr.push(item);
    linksByTask.set(taskId, arr);
  };
  for (const l of board.links) {
    const sTitle = titleById.get(l.sourceTaskId);
    const tTitle = titleById.get(l.targetTaskId);
    if (!sTitle || !tTitle) continue;
    pushLink(l.sourceTaskId, { otherTitle: tTitle, type: l.type, direction: "out" });
    pushLink(l.targetTaskId, { otherTitle: sTitle, type: l.type, direction: "in" });
  }

  const columns: BoardColumn[] = board.columns.map((c) => ({
    id: c.id,
    title: c.title,
    systemKey: c.systemKey,
    tasks: c.tasks.map((t) => ({
      id: t.id,
      columnId: t.columnId,
      title: t.title,
      description: t.description,
      color: t.color,
      priority: t.priority,
      isPersonal: t.isPersonal,
      recurFreq: t.recurFreq,
      recurInterval: t.recurInterval,
      recurDays: t.recurDays,
      recurUntil: toDateInput(t.recurUntil),
      startDate: toDateInput(t.startDate),
      dueDate: toDateInput(t.dueDate),
      createdById: t.createdById,
      createdByName: shortName(t.createdBy),
      assigneeIds: t.assignees.map((a) => a.userId),
      assignees: t.assignees.map((a) => ({
        userId: a.userId,
        initials: initials(a.user),
        shortName: shortName(a.user),
        confirmed: a.confirmed,
        avatar: a.user.avatar,
        emoji: a.user.avatarEmoji,
      })),
      labels: t.labels.map((tl) => ({
        id: tl.label.id,
        name: tl.label.name,
        color: tl.label.color,
      })),
      comments: t.comments.map((c) => ({
        id: c.id,
        body: c.body,
        authorName: shortName(c.user),
        authorInitials: initials(c.user),
        authorAvatar: c.user.avatar,
        authorEmoji: c.user.avatarEmoji,
        userId: c.userId,
        createdAt: c.createdAt.toISOString(),
      })),
      links: linksByTask.get(t.id) ?? [],
    })),
  }));

  // Directory for inviting people to a personal board (owner only).
  let directory: DirectoryUser[] = [];
  if (isOwner && board.isPersonal) {
    const users = await prisma.user.findMany({
      where: { isActive: true, id: { not: board.ownerId } },
      orderBy: { lastName: "asc" },
      select: userSelect,
    });
    directory = users.map((u) => ({
      id: u.id,
      fullName: fullName(u),
      username: u.username,
      initials: initials(u),
      avatar: u.avatar,
      emoji: u.avatarEmoji,
    }));
  }

  return (
    <BoardView
      boardId={board.id}
      title={board.title}
      color={board.color ?? "#0ea5e9"}
      isPersonal={board.isPersonal}
      role={role}
      currentUserId={user.id}
      isAdmin={user.role === "ADMIN"}
      columns={columns}
      members={headerMembers}
      assignable={assignable}
      directory={directory}
    />
  );
}
