import "server-only";
import { prisma } from "./prisma";
import { shortName } from "./names";

export type WorkspaceAnalytics = {
  users: { total: number; active7d: number };
  boards: number;
  tasks: { total: number; active: number; completed: number; overdue: number };
  createdThisWeek: number;
  hoursLogged: number;
  createdSeries: { date: string; count: number }[];
  topContributors: { name: string; completed: number }[];
};

const DAY = 86400000;

export async function getWorkspaceAnalytics(): Promise<WorkspaceAnalytics> {
  const now = new Date();
  const startToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const notCompleted = {
    OR: [{ systemKey: null }, { systemKey: { not: "COMPLETED" } }],
  };

  const [
    usersTotal,
    usersActive,
    boards,
    tasksTotal,
    tasksCompleted,
    tasksOverdue,
    createdThisWeek,
    timeAgg,
    recentTasks,
    completedAssignees,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, lastSeenAt: { gte: weekAgo } } }),
    prisma.board.count(),
    prisma.task.count({ where: { parentId: null } }),
    prisma.task.count({ where: { column: { systemKey: "COMPLETED" } } }),
    prisma.task.count({
      where: { dueDate: { lt: startToday }, column: notCompleted },
    }),
    prisma.task.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.timeEntry.aggregate({ _sum: { minutes: true } }),
    prisma.task.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { createdAt: true },
    }),
    prisma.taskAssignee.findMany({
      where: { task: { column: { systemKey: "COMPLETED" } } },
      select: {
        user: { select: { lastName: true, firstName: true, middleName: true } },
      },
    }),
  ]);

  const tasksActive = Math.max(0, tasksTotal - tasksCompleted);

  // 7-day created-tasks series (oldest → newest).
  const series: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startToday.getTime() - i * DAY);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, count: 0 });
  }
  const byDay = new Map(series.map((s) => [s.date, s]));
  for (const t of recentTasks) {
    const key = t.createdAt.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) bucket.count++;
  }

  // Top contributors by completed tasks.
  const counts = new Map<string, number>();
  for (const a of completedAssignees) {
    const name = shortName(a.user);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const topContributors = [...counts.entries()]
    .map(([name, completed]) => ({ name, completed }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5);

  return {
    users: { total: usersTotal, active7d: usersActive },
    boards,
    tasks: {
      total: tasksTotal,
      active: tasksActive,
      completed: tasksCompleted,
      overdue: tasksOverdue,
    },
    createdThisWeek,
    hoursLogged: Math.round((timeAgg._sum.minutes ?? 0) / 60),
    createdSeries: series,
    topContributors,
  };
}
