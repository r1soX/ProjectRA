import { requireUser } from "@/lib/auth";
import { getUserBoards } from "@/lib/boards";
import { shortName } from "@/lib/names";
import { PageContainer } from "@/components/ui/page-container";
import { BoardsClient, type BoardCard } from "./boards-client";

export default async function BoardsPage() {
  const user = await requireUser();
  const boards = await getUserBoards(user.id);

  const data: BoardCard[] = boards.map((b) => ({
    id: b.id,
    title: b.title,
    color: b.color ?? "#0ea5e9",
    isPersonal: b.isPersonal,
    ownerName: shortName(b.owner),
    taskCount: b._count.tasks,
  }));

  return (
    <PageContainer>
      <BoardsClient boards={data} />
    </PageContainer>
  );
}
