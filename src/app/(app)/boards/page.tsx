import { requireUser } from "@/lib/auth";
import { getUserBoards } from "@/lib/boards";
import { hasPerm, PERMS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { shortName } from "@/lib/names";
import { PageContainer } from "@/components/ui/page-container";
import { BoardsClient, type BoardCard } from "./boards-client";

export default async function BoardsPage() {
  const user = await requireUser();
  const canView = await hasPerm(user.id, user.role, PERMS.BOARD_VIEW);
  const boards = canView ? await getUserBoards(user.id) : [];

  const data: BoardCard[] = boards.map((b) => ({
    id: b.id,
    title: b.title,
    color: b.color ?? "#0ea5e9",
    isPersonal: b.isPersonal,
    ownerName: shortName(b.owner),
    taskCount: b._count.tasks,
  }));

  const templates = await prisma.boardTemplate.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <PageContainer>
      <BoardsClient boards={data} templates={templates} />
    </PageContainer>
  );
}
