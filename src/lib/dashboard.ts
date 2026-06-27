import "server-only";
import { prisma } from "./prisma";

export type MyTask = {
  id: string;
  title: string;
  boardId: string;
  boardTitle: string;
  boardColor: string;
  columnTitle: string;
  priority: string;
  dueDate: string | null;
  bucket: "overdue" | "today" | "upcoming" | "none";
};

export type MyWork = {
  tasks: MyTask[];
  stats: { active: number; overdue: number; today: number; week: number };
};

/** Tasks assigned to the user that aren't completed, bucketed by urgency. */
export async function getMyWork(userId: string): Promise<MyWork> {
  const now = new Date();
  const startToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const startTomorrow = new Date(startToday.getTime() + 86400000);
  const weekEnd = new Date(startToday.getTime() + 7 * 86400000);

  const rows = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      // `not: "COMPLETED"` alone would drop NULL systemKey (regular columns),
      // since SQL `<>` excludes NULLs — so allow null explicitly.
      column: { OR: [{ systemKey: null }, { systemKey: { not: "COMPLETED" } }] },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      boardId: true,
      board: { select: { title: true, color: true } },
      column: { select: { title: true } },
    },
  });

  const tasks: MyTask[] = rows.map((t) => {
    let bucket: MyTask["bucket"] = "none";
    if (t.dueDate) {
      if (t.dueDate < startToday) bucket = "overdue";
      else if (t.dueDate < startTomorrow) bucket = "today";
      else bucket = "upcoming";
    }
    return {
      id: t.id,
      title: t.title,
      boardId: t.boardId,
      boardTitle: t.board.title,
      boardColor: t.board.color ?? "#0ea5e9",
      columnTitle: t.column.title,
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
      bucket,
    };
  });

  // Sort: overdue → today → upcoming → no-date.
  const order = { overdue: 0, today: 1, upcoming: 2, none: 3 };
  tasks.sort((a, b) => order[a.bucket] - order[b.bucket]);

  const stats = {
    active: tasks.length,
    overdue: tasks.filter((t) => t.bucket === "overdue").length,
    today: tasks.filter((t) => t.bucket === "today").length,
    week: rows.filter(
      (t) => t.dueDate && t.dueDate >= startToday && t.dueDate < weekEnd,
    ).length,
  };

  return { tasks, stats };
}
