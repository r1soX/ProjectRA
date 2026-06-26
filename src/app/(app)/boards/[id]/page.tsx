import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBoardWithData } from "@/lib/boards";
import { shortName, initials, fullName } from "@/lib/names";
import {
  BoardView,
  type BoardColumn,
  type BoardMemberView,
  type DirectoryUser,
} from "./board-view";

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
  const result = await getBoardWithData(id, user.id);
  if (!result) notFound();

  const { board, role } = result;
  const isOwner = role === "OWNER";

  // People who can be assigned: owner + members (deduped).
  const memberMap = new Map<string, BoardMemberView>();
  memberMap.set(board.owner.id, {
    userId: board.owner.id,
    role: "OWNER",
    shortName: shortName(board.owner),
    initials: initials(board.owner),
    username: board.owner.username,
  });
  for (const m of board.members) {
    if (!memberMap.has(m.userId)) {
      memberMap.set(m.userId, {
        userId: m.userId,
        role: m.role,
        shortName: shortName(m.user),
        initials: initials(m.user),
        username: m.user.username,
      });
    }
  }
  const members = [...memberMap.values()];

  const columns: BoardColumn[] = board.columns.map((c) => ({
    id: c.id,
    title: c.title,
    tasks: c.tasks.map((t) => ({
      id: t.id,
      columnId: t.columnId,
      title: t.title,
      description: t.description,
      color: t.color,
      startDate: toDateInput(t.startDate),
      dueDate: toDateInput(t.dueDate),
      createdByName: shortName(t.createdBy),
      assigneeIds: t.assignees.map((a) => a.userId),
      assignees: t.assignees.map((a) => ({
        initials: initials(a.user),
        shortName: shortName(a.user),
      })),
      labels: t.labels.map((tl) => ({
        id: tl.label.id,
        name: tl.label.name,
        color: tl.label.color,
      })),
    })),
  }));

  // Directory for member management (owners only).
  let directory: DirectoryUser[] = [];
  if (isOwner && !board.isPersonal) {
    const users = await prisma.user.findMany({
      where: { isActive: true, id: { not: board.ownerId } },
      orderBy: { lastName: "asc" },
      select: {
        id: true,
        username: true,
        lastName: true,
        firstName: true,
        middleName: true,
      },
    });
    directory = users.map((u) => ({
      id: u.id,
      fullName: fullName(u),
      username: u.username,
      initials: initials(u),
    }));
  }

  return (
    <BoardView
      boardId={board.id}
      title={board.title}
      color={board.color ?? "#0ea5e9"}
      isPersonal={board.isPersonal}
      role={role}
      columns={columns}
      members={members}
      directory={directory}
    />
  );
}
