import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shortName, initials } from "@/lib/names";
import { WorkloadClient } from "./workload-client";

export default async function WorkloadPage() {
  const currentUser = await requireUser();

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

  // Build per-user task lists
  const byUser = new Map<string, typeof tasks>();
  for (const t of tasks) {
    for (const a of t.assignees) {
      const arr = byUser.get(a.userId) ?? [];
      arr.push(t);
      byUser.set(a.userId, arr);
    }
  }

  const now = new Date();

  return (
    <WorkloadClient
      currentUserId={currentUser.id}
      users={users.map((u) => {
        const userTasks = byUser.get(u.id) ?? [];
        const overdue = userTasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) < now,
        ).length;
        return {
          id: u.id,
          fullName: shortName(u),
          initials: initials(u),
          avatar: u.avatar,
          emoji: u.avatarEmoji,
          role: u.role,
          taskCount: userTasks.length,
          overdueCount: overdue,
          tasks: userTasks.map((t) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            dueDate: t.dueDate ? t.dueDate.toISOString() : null,
            boardId: t.board.id,
            boardTitle: t.board.title,
            columnTitle: t.column.title,
            isOverdue: !!(t.dueDate && new Date(t.dueDate) < now),
          })),
        };
      })}
    />
  );
}
