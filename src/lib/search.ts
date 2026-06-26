import "server-only";
import { prisma } from "./prisma";
import { getUserBoards } from "./boards";

export type TaskHit = {
  id: string;
  title: string;
  boardId: string;
  boardTitle: string;
  boardColor: string;
  columnTitle: string;
  priority: string;
};
export type BoardHit = { id: string; title: string; color: string };

/**
 * Search across the boards the user can access. Filters in JS so the match
 * is case-insensitive for Cyrillic too (SQLite LIKE isn't).
 */
export async function search(meId: string, isAdmin: boolean, raw: string) {
  const q = raw.trim().toLowerCase();
  if (q.length < 2) return { tasks: [] as TaskHit[], boards: [] as BoardHit[] };

  const boards = await getUserBoards(meId);
  const boardMeta = new Map(
    boards.map((b) => [b.id, { title: b.title, color: b.color ?? "#0ea5e9" }]),
  );
  if (boardMeta.size === 0) return { tasks: [], boards: [] };

  const boardHits: BoardHit[] = boards
    .filter((b) => b.title.toLowerCase().includes(q))
    .slice(0, 8)
    .map((b) => ({ id: b.id, title: b.title, color: b.color ?? "#0ea5e9" }));

  const candidates = await prisma.task.findMany({
    where: {
      boardId: { in: [...boardMeta.keys()] },
      ...(isAdmin ? {} : { OR: [{ isPersonal: false }, { createdById: meId }] }),
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      id: true,
      title: true,
      boardId: true,
      priority: true,
      column: { select: { title: true } },
    },
  });

  const tasks: TaskHit[] = candidates
    .filter((t) => t.title.toLowerCase().includes(q))
    .slice(0, 40)
    .map((t) => {
      const b = boardMeta.get(t.boardId)!;
      return {
        id: t.id,
        title: t.title,
        boardId: t.boardId,
        boardTitle: b.title,
        boardColor: b.color,
        columnTitle: t.column.title,
        priority: t.priority,
      };
    });

  return { tasks, boards: boardHits };
}
