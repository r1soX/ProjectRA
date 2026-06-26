import "server-only";
import { prisma } from "./prisma";
import { getBoardRole } from "./boards";

export type LinkNode = {
  id: string;
  title: string;
  priority: string;
  color: string | null;
  columnTitle: string;
  x: number | null;
  y: number | null;
};
export type LinkEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
};

export async function getBoardLinks(boardId: string, userId: string) {
  const role = await getBoardRole(boardId, userId);
  if (!role) return null;

  const [board, tasks, links] = await Promise.all([
    prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, title: true, color: true },
    }),
    prisma.task.findMany({
      where: { boardId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        priority: true,
        color: true,
        canvasX: true,
        canvasY: true,
        column: { select: { title: true } },
      },
    }),
    prisma.taskLink.findMany({
      where: { boardId },
      select: { id: true, sourceTaskId: true, targetTaskId: true, type: true },
    }),
  ]);
  if (!board) return null;

  const nodes: LinkNode[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    color: t.color,
    columnTitle: t.column.title,
    x: t.canvasX,
    y: t.canvasY,
  }));
  const edges: LinkEdge[] = links.map((l) => ({
    id: l.id,
    source: l.sourceTaskId,
    target: l.targetTaskId,
    type: l.type,
  }));

  return { role, board, nodes, edges };
}
