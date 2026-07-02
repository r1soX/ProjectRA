import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBoardLinks } from "@/lib/links";
import { hasPerm, PERMS } from "@/lib/permissions";
import { LinksCanvas } from "./links-canvas";

export default async function BoardLinksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireUser();
  const viewAllTasks = await hasPerm(me.id, me.role, PERMS.TASK_VIEW_ALL);
  const data = await getBoardLinks(id, me.id, viewAllTasks);
  if (!data) notFound();

  const canEdit = data.role === "OWNER" || data.role === "EDITOR";

  return (
    <LinksCanvas
      boardId={data.board.id}
      boardTitle={data.board.title}
      canEdit={canEdit}
      nodes={data.nodes}
      edges={data.edges}
    />
  );
}
