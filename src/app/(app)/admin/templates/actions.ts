"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { hasPerm, PERMS } from "@/lib/permissions";

/** Managing board templates needs the ADMIN role + the explicit capability. */
async function requireTemplateAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Нет прав");
  if (!(await hasPerm(user.id, user.role, PERMS.ADMIN_TEMPLATES_MANAGE))) {
    throw new Error("Недостаточно прав");
  }
  return user;
}

function cleanColumns(columns: string[]): string[] {
  return columns.map((c) => c.trim()).filter(Boolean).slice(0, 20);
}

export async function createTemplate(
  name: string,
  description: string,
  columns: string[],
) {
  const user = await requireTemplateAdmin();
  const trimmed = name.trim();
  if (!trimmed) return;
  const cols = cleanColumns(columns);
  await prisma.boardTemplate.create({
    data: {
      name: trimmed.slice(0, 60),
      description: description.trim().slice(0, 200) || null,
      createdById: user.id,
      columns: { create: cols.map((title, i) => ({ title, order: i })) },
    },
  });
  revalidatePath("/admin/templates");
}

export async function updateTemplate(
  id: string,
  name: string,
  description: string,
  columns: string[],
) {
  await requireTemplateAdmin();
  const tpl = await prisma.boardTemplate.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!tpl) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const cols = cleanColumns(columns);
  await prisma.$transaction([
    prisma.templateColumn.deleteMany({ where: { templateId: id } }),
    prisma.boardTemplate.update({
      where: { id },
      data: {
        name: trimmed.slice(0, 60),
        description: description.trim().slice(0, 200) || null,
        columns: { create: cols.map((title, i) => ({ title, order: i })) },
      },
    }),
  ]);
  revalidatePath("/admin/templates");
}

export async function deleteTemplate(id: string) {
  await requireTemplateAdmin();
  await prisma.boardTemplate.delete({ where: { id } });
  revalidatePath("/admin/templates");
}
