"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const MAX_TITLE = 120;
const MAX_BODY = 20000;

function clean(title: string) {
  return title.trim().slice(0, MAX_TITLE) || null;
}

/** Create a note owned by the current user. */
export async function createNote(
  title: string,
  body: string,
  color: string | null,
): Promise<void> {
  const me = await requireUser();
  await prisma.note.create({
    data: {
      userId: me.id,
      title: clean(title),
      body: body.slice(0, MAX_BODY),
      color: color || null,
    },
  });
  revalidatePath("/notes");
}

/** Edit a note — only its owner may. */
export async function updateNote(
  id: string,
  title: string,
  body: string,
  color: string | null,
): Promise<void> {
  const me = await requireUser();
  await prisma.note.updateMany({
    where: { id, userId: me.id },
    data: { title: clean(title), body: body.slice(0, MAX_BODY), color: color || null },
  });
  revalidatePath("/notes");
}

export async function deleteNote(id: string): Promise<void> {
  const me = await requireUser();
  await prisma.note.deleteMany({ where: { id, userId: me.id } });
  revalidatePath("/notes");
}

export async function toggleNotePin(id: string): Promise<void> {
  const me = await requireUser();
  const note = await prisma.note.findFirst({
    where: { id, userId: me.id },
    select: { pinned: true },
  });
  if (!note) return;
  await prisma.note.update({ where: { id }, data: { pinned: !note.pinned } });
  revalidatePath("/notes");
}
