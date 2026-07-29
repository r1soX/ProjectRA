import { requireUser } from "@/lib/auth";
import { getUserBoards, getArchivedBoards } from "@/lib/boards";
import { hasPerm, PERMS } from "@/lib/permissions";
import { ensureSystemBoardTemplates } from "@/lib/board-templates";
import { prisma } from "@/lib/prisma";
import { shortName } from "@/lib/names";
import { PageContainer } from "@/components/ui/page-container";
import { AccessDenied } from "@/components/ui/access-denied";
import { BoardsClient, type BoardCard } from "./boards-client";

export default async function BoardsPage() {
  const user = await requireUser();
  if (!(await hasPerm(user.id, user.role, PERMS.BOARD_VIEW))) {
    return (
      <PageContainer>
        <AccessDenied message="У вас нет прав на просмотр досок. Если это ошибка — обратитесь к администратору." />
      </PageContainer>
    );
  }
  const [canCreate, viewAll, manageAll] = await Promise.all([
    hasPerm(user.id, user.role, PERMS.BOARD_CREATE),
    hasPerm(user.id, user.role, PERMS.BOARD_VIEW_ALL),
    hasPerm(user.id, user.role, PERMS.BOARD_MANAGE_ALL),
  ]);
  await ensureSystemBoardTemplates();
  const [boards, archived] = await Promise.all([
    getUserBoards(user.id, viewAll),
    getArchivedBoards(user.id, viewAll),
  ]);

  // Per-board task breakdown (done / in-progress) for the active board cards.
  const activeIds = boards.map((b) => b.id);
  const grouped = activeIds.length
    ? await prisma.task.groupBy({
        by: ["boardId", "status"],
        where: { boardId: { in: activeIds } },
        _count: { _all: true },
      })
    : [];
  const doneBy = new Map<string, number>();
  const progBy = new Map<string, number>();
  for (const g of grouped) {
    if (g.status === "done") doneBy.set(g.boardId, g._count._all);
    else if (g.status === "in_progress") progBy.set(g.boardId, g._count._all);
  }

  const toCard = (b: (typeof boards)[number]): BoardCard => ({
    id: b.id,
    title: b.title,
    color: b.color ?? "#0ea5e9",
    isPersonal: b.isPersonal,
    ownerName: shortName(b.owner),
    taskCount: b._count.tasks,
    doneCount: doneBy.get(b.id) ?? 0,
    inProgressCount: progBy.get(b.id) ?? 0,
    // The owner — or anyone with global board management — manages archiving.
    canArchive: b.ownerId === user.id || manageAll,
  });

  const data = boards.map(toCard);
  const archivedData = archived.map(toCard);

  const templates = await prisma.boardTemplate.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <PageContainer>
      <BoardsClient
        boards={data}
        archived={archivedData}
        templates={templates}
        canCreate={canCreate}
      />
    </PageContainer>
  );
}
