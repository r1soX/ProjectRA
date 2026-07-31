import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPerm, PERMS } from "@/lib/permissions";
import { fullName } from "@/lib/names";
import { PageContainer } from "@/components/ui/page-container";
import { NotesClient, type NoteView } from "./notes-client";

export const metadata = { title: "Заметки · Projectra" };

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const me = await requireUser();
  const canViewAll = await hasPerm(me.id, me.role, PERMS.NOTE_VIEW_ALL);
  const { user: viewUserId } = await searchParams;

  // Admins with note.view.all may open another user's notes (read-only).
  const targetId =
    canViewAll && viewUserId && viewUserId !== me.id ? viewUserId : me.id;
  const readOnly = targetId !== me.id;

  const [notes, target, users] = await Promise.all([
    prisma.note.findMany({
      where: { userId: targetId },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
    readOnly
      ? prisma.user.findUnique({
          where: { id: targetId },
          select: { lastName: true, firstName: true, middleName: true, username: true },
        })
      : Promise.resolve(null),
    canViewAll
      ? prisma.user.findMany({
          where: { isActive: true },
          orderBy: { lastName: "asc" },
          select: { id: true, lastName: true, firstName: true, middleName: true },
        })
      : Promise.resolve([]),
  ]);

  const data: NoteView[] = notes.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    color: n.color,
    pinned: n.pinned,
    updatedAt: n.updatedAt.toISOString(),
  }));

  return (
    <PageContainer>
      <NotesClient
        notes={data}
        readOnly={readOnly}
        canViewAll={canViewAll}
        targetUserId={targetId}
        targetName={target ? fullName(target) : null}
        users={users.map((u) => ({ id: u.id, name: fullName(u) }))}
      />
    </PageContainer>
  );
}
