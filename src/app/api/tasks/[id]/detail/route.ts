import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shortName } from "@/lib/names";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      boardId: true,
      subtasks: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          column: { select: { systemKey: true } },
        },
      },
      history: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          action: true,
          meta: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              lastName: true,
              firstName: true,
              middleName: true,
            },
          },
        },
      },
      timeEntries: {
        orderBy: { loggedAt: "desc" },
        select: {
          id: true,
          minutes: true,
          note: true,
          loggedAt: true,
          user: {
            select: {
              id: true,
              lastName: true,
              firstName: true,
              middleName: true,
            },
          },
        },
      },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Access check: user must have board access
  const board = await prisma.board.findUnique({
    where: { id: task.boardId },
    select: { isPersonal: true, ownerId: true, members: { select: { userId: true } } },
  });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (
    board.isPersonal &&
    board.ownerId !== user.id &&
    !board.members.some((m) => m.userId === user.id) &&
    user.role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    subtasks: task.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      done: s.column.systemKey === "COMPLETED",
    })),
    history: task.history.map((h) => ({
      id: h.id,
      action: h.action,
      meta: h.meta ? JSON.parse(h.meta) : null,
      createdAt: h.createdAt.toISOString(),
      userName: shortName(h.user),
      isMe: h.user.id === user.id,
    })),
    timeEntries: task.timeEntries.map((e) => ({
      id: e.id,
      minutes: e.minutes,
      note: e.note,
      loggedAt: e.loggedAt.toISOString(),
      userName: shortName(e.user),
      isMe: e.user.id === user.id,
    })),
  });
}
