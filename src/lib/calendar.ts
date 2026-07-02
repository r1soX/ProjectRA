import "server-only";
import { prisma } from "./prisma";
import { getUserBoards } from "./boards";
import { initials } from "./names";

export type CalendarTask = {
  id: string;
  title: string;
  boardId: string;
  boardTitle: string;
  boardColor: string;
  priority: string;
  color: string | null;
  startDate: string | null;
  dueDate: string; // yyyy-mm-dd (always present here)
  createdById: string;
  assignees: {
    initials: string;
    avatar: string | null;
    emoji: string | null;
  }[];
};

function toDateInput(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/**
 * All dated tasks across the boards the user can access. With `viewAll`
 * (BOARD_VIEW_ALL) the scope widens to every board and every personal task.
 */
export async function getCalendarTasks(
  meId: string,
  viewAll = false,
): Promise<CalendarTask[]> {
  const boards = await getUserBoards(meId, viewAll);
  const boardMap = new Map(
    boards.map((b) => [b.id, { title: b.title, color: b.color ?? "#0ea5e9" }]),
  );
  if (boardMap.size === 0) return [];

  const tasks = await prisma.task.findMany({
    where: {
      boardId: { in: [...boardMap.keys()] },
      dueDate: { not: null },
      ...(viewAll
        ? {}
        : { OR: [{ isPersonal: false }, { createdById: meId }] }),
    },
    orderBy: { dueDate: "asc" },
    include: {
      assignees: {
        include: {
          user: {
            select: {
              lastName: true,
              firstName: true,
              middleName: true,
              avatar: true,
              avatarEmoji: true,
            },
          },
        },
      },
    },
  });

  return tasks.map((t) => {
    const b = boardMap.get(t.boardId)!;
    return {
      id: t.id,
      title: t.title,
      boardId: t.boardId,
      boardTitle: b.title,
      boardColor: b.color,
      priority: t.priority,
      color: t.color,
      startDate: toDateInput(t.startDate),
      dueDate: toDateInput(t.dueDate)!,
      createdById: t.createdById,
      assignees: t.assignees.map((a) => ({
        initials: initials(a.user),
        avatar: a.user.avatar,
        emoji: a.user.avatarEmoji,
      })),
    };
  });
}
