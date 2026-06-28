import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPerm, PERMS } from "@/lib/permissions";
import { AccessDenied } from "@/components/ui/access-denied";
import { shortName, initials } from "@/lib/names";
import { WorkloadClient } from "./workload-client";

export default async function WorkloadPage() {
  const currentUser = await requireUser();
  if (!(await hasPerm(currentUser.id, currentUser.role, PERMS.TASK_VIEW))) {
    return <AccessDenied message="У вас нет прав на просмотр задач." />;
  }

  // Fetch all active users
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: "asc" }],
    select: {
      id: true,
      username: true,
      lastName: true,
      firstName: true,
      middleName: true,
      avatar: true,
      avatarEmoji: true,
      role: true,
    },
  });

  // Fetch tasks with assignees — only non-completed ones
  const tasks = await prisma.task.findMany({
    where: {
      parentId: null,
      column: {
        OR: [
          { systemKey: null },
          { systemKey: { not: "COMPLETED" } },
        ],
      },
      assignees: { some: {} },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      boardId: true,
      board: { select: { id: true, title: true } },
      column: { select: { title: true, systemKey: true } },
      assignees: { select: { userId: true, confirmed: true } },
    },
  });

  // Build per-user task lists, keeping THIS user's own confirmation per task.
  const byUser = new Map<
    string,
    { task: (typeof tasks)[number]; confirmed: boolean }[]
  >();
  for (const t of tasks) {
    for (const a of t.assignees) {
      const arr = byUser.get(a.userId) ?? [];
      arr.push({ task: t, confirmed: a.confirmed });
      byUser.set(a.userId, arr);
    }
  }

  // Overdue means strictly before today (midnight) — a task due *today* is not
  // overdue, matching the board, calendar and deadline-reminder logic.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <WorkloadClient
      currentUserId={currentUser.id}
      users={users.map((u) => {
        const userTasks = byUser.get(u.id) ?? [];
        const entries = userTasks.map(({ task: t, confirmed }) => {
          const overdue = !!(t.dueDate && new Date(t.dueDate) < today);
          return {
            id: t.id,
            title: t.title,
            priority: t.priority,
            dueDate: t.dueDate ? t.dueDate.toISOString() : null,
            boardId: t.board.id,
            boardTitle: t.board.title,
            columnTitle: t.column.title,
            // This user has signed off their part → it isn't their load/overdue.
            confirmed,
            isOverdue: overdue && !confirmed,
            confirmedCount: t.assignees.filter((a) => a.confirmed).length,
            assigneeCount: t.assignees.length,
          };
        });
        // Sort: own pending first, then done; overdue floats to the top.
        entries.sort((a, b) => {
          if (a.confirmed !== b.confirmed) return a.confirmed ? 1 : -1;
          if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
          return 0;
        });
        const pending = entries.filter((e) => !e.confirmed);
        return {
          id: u.id,
          fullName: shortName(u),
          initials: initials(u),
          avatar: u.avatar,
          emoji: u.avatarEmoji,
          role: u.role,
          // Active load = tasks the user hasn't signed off yet.
          taskCount: pending.length,
          doneCount: entries.length - pending.length,
          overdueCount: pending.filter((e) => e.isOverdue).length,
          tasks: entries,
        };
      })}
    />
  );
}
