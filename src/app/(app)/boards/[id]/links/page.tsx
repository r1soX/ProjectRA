import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBoardLinks } from "@/lib/links";
import { LinksCanvas } from "./links-canvas";

export default async function BoardLinksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireUser();
  const data = await getBoardLinks(id, me.id);
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
