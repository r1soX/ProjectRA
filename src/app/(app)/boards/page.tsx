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
  const canCreate = await hasPerm(user.id, user.role, PERMS.BOARD_CREATE);
  await ensureSystemBoardTemplates();
  const [boards, archived] = await Promise.all([
    getUserBoards(user.id, user.role === "ADMIN"),
    getArchivedBoards(user.id, user.role === "ADMIN"),
  ]);

  const toCard = (b: (typeof boards)[number]): BoardCard => ({
    id: b.id,
    title: b.title,
    color: b.color ?? "#0ea5e9",
    isPersonal: b.isPersonal,
    ownerName: shortName(b.owner),
    taskCount: b._count.tasks,
    // Only the owner (or an admin) manages a board's archive state.
    canArchive: b.ownerId === user.id || user.role === "ADMIN",
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
