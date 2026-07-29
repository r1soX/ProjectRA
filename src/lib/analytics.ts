import "server-only";
import { prisma } from "./prisma";
import { shortName } from "./names";

export type WorkspaceAnalytics = {
  users: { total: number; active7d: number };
  boards: number;
  tasks: {
    total: number;
    active: number;
    completed: number;
    overdue: number;
    soonDue: number;
  };
  completionRate: number; // 0–100
  createdThisWeek: number;
  completedThisWeek: number;
  hoursLogged: number;
  createdSeries: { date: string; count: number }[]; // last 14 days
  statusDistribution: { status: string; count: number }[];
  priorityDistribution: { priority: string; count: number }[];
  boardStats: {
    title: string;
    total: number;
    completed: number;
    overdue: number;
  }[];
  topContributors: { name: string; completed: number }[];
  workload: { name: string; active: number }[];
};

const DAY = 86400000;
const SERIES_DAYS = 14;

export async function getWorkspaceAnalytics(): Promise<WorkspaceAnalytics> {
  const now = new Date();
  const startToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const weekAhead = new Date(startToday.getTime() + 7 * DAY);
  const notCompleted = {
    OR: [{ systemKey: null }, { systemKey: { not: "COMPLETED" } }],
  };
  const rootTasks = { parentId: null };

  const [
    usersTotal,
    usersActive,
    boards,
    tasksTotal,
    tasksCompleted,
    tasksOverdue,
    tasksSoonDue,
    createdThisWeek,
    completedThisWeek,
    timeAgg,
    recentTasks,
    completedAssignees,
    activeAssignees,
    statusGroups,
    priorityGroups,
    boardList,
    totalByBoard,
    doneByBoard,
    overdueByBoard,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, lastSeenAt: { gte: weekAgo } } }),
    prisma.board.count(),
    prisma.task.count({ where: rootTasks }),
    prisma.task.count({
      where: { parentId: null, column: { systemKey: "COMPLETED" } },
    }),
    prisma.task.count({
      where: { parentId: null, dueDate: { lt: startToday }, column: notCompleted },
    }),
    prisma.task.count({
      where: {
        parentId: null,
        dueDate: { gte: startToday, lte: weekAhead },
        column: notCompleted,
      },
    }),
    prisma.task.count({ where: { parentId: null, createdAt: { gte: weekAgo } } }),
    prisma.task.count({
      where: {
        parentId: null,
        column: { systemKey: "COMPLETED" },
        updatedAt: { gte: weekAgo },
      },
    }),
    prisma.timeEntry.aggregate({ _sum: { minutes: true } }),
    prisma.task.findMany({
      where: {
        parentId: null,
        createdAt: { gte: new Date(startToday.getTime() - (SERIES_DAYS - 1) * DAY) },
      },
      select: { createdAt: true },
    }),
    prisma.taskAssignee.findMany({
      where: { task: { parentId: null, column: { systemKey: "COMPLETED" } } },
      select: {
        user: { select: { lastName: true, firstName: true, middleName: true } },
      },
    }),
    prisma.taskAssignee.findMany({
      where: { task: { parentId: null, column: notCompleted } },
      select: {
        user: { select: { lastName: true, firstName: true, middleName: true } },
      },
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: rootTasks,
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["priority"],
      where: rootTasks,
      _count: { _all: true },
    }),
    prisma.board.findMany({ select: { id: true, title: true } }),
    prisma.task.groupBy({ by: ["boardId"], where: rootTasks, _count: { _all: true } }),
    prisma.task.groupBy({
      by: ["boardId"],
      where: { parentId: null, column: { systemKey: "COMPLETED" } },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["boardId"],
      where: { parentId: null, dueDate: { lt: startToday }, column: notCompleted },
      _count: { _all: true },
    }),
  ]);

  const tasksActive = Math.max(0, tasksTotal - tasksCompleted);
  const completionRate =
    tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

  // Created-tasks series (oldest → newest).
  const series: { date: string; count: number }[] = [];
  for (let i = SERIES_DAYS - 1; i >= 0; i--) {
    const d = new Date(startToday.getTime() - i * DAY);
    series.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  const byDay = new Map(series.map((s) => [s.date, s]));
  for (const t of recentTasks) {
    const bucket = byDay.get(t.createdAt.toISOString().slice(0, 10));
    if (bucket) bucket.count++;
  }

  const statusDistribution = statusGroups.map((g) => ({
    status: g.status,
    count: g._count._all,
  }));
  const priorityDistribution = priorityGroups.map((g) => ({
    priority: g.priority,
    count: g._count._all,
  }));

  // Per-board stats (top boards by task count).
  const doneMap = new Map(doneByBoard.map((g) => [g.boardId, g._count._all]));
  const overdueMap = new Map(overdueByBoard.map((g) => [g.boardId, g._count._all]));
  const titleMap = new Map(boardList.map((b) => [b.id, b.title]));
  const boardStats = totalByBoard
    .map((g) => ({
      title: titleMap.get(g.boardId) ?? "—",
      total: g._count._all,
      completed: doneMap.get(g.boardId) ?? 0,
      overdue: overdueMap.get(g.boardId) ?? 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const rankByName = (
    rows: {
      user: { lastName: string; firstName: string; middleName: string | null };
    }[],
  ): { name: string; count: number }[] => {
    const counts = new Map<string, number>();
    for (const a of rows) {
      const name = shortName(a.user);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  };

  return {
    users: { total: usersTotal, active7d: usersActive },
    boards,
    tasks: {
      total: tasksTotal,
      active: tasksActive,
      completed: tasksCompleted,
      overdue: tasksOverdue,
      soonDue: tasksSoonDue,
    },
    completionRate,
    createdThisWeek,
    completedThisWeek,
    hoursLogged: Math.round((timeAgg._sum.minutes ?? 0) / 60),
    createdSeries: series,
    statusDistribution,
    priorityDistribution,
    boardStats,
    topContributors: rankByName(completedAssignees).map((x) => ({
      name: x.name,
      completed: x.count,
    })),
    workload: rankByName(activeAssignees).map((x) => ({
      name: x.name,
      active: x.count,
    })),
  };
}
