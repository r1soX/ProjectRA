"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { hasPerm, PERMS } from "@/lib/permissions";

async function requireManage() {
  const user = await requireAdmin();
  if (!(await hasPerm(user.id, user.role, PERMS.ADMIN_STATUSES_MANAGE))) {
    throw new Error("Недостаточно прав");
  }
  return user;
}

function normalizeColor(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "#64748b";
}

function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-я0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  return base || "status";
}

export async function createStatus(label: string, color: string) {
  await requireManage();
  const l = label.trim().slice(0, 40);
  if (!l) return;

  const existing = new Set(
    (await prisma.statusDef.findMany({ select: { key: true } })).map((r) => r.key),
  );
  let key = slugify(l);
  if (existing.has(key)) {
    let i = 2;
    while (existing.has(`${key}_${i}`)) i++;
    key = `${key}_${i}`;
  }

  const max = await prisma.statusDef.aggregate({ _max: { order: true } });
  await prisma.statusDef.create({
    data: {
      key,
      label: l,
      color: normalizeColor(color),
      order: (max._max.order ?? -1) + 1,
      isSystem: false,
    },
  });
  revalidatePath("/admin/statuses");
}

export async function updateStatus(id: string, label: string, color: string) {
  await requireManage();
  const l = label.trim().slice(0, 40);
  if (!l) return;
  await prisma.statusDef.update({
    where: { id },
    data: { label: l, color: normalizeColor(color) },
  });
  revalidatePath("/admin/statuses");
}

export async function deleteStatus(id: string) {
  await requireManage();
  const s = await prisma.statusDef.findUnique({
    where: { id },
    select: { isSystem: true, key: true },
  });
  if (!s || s.isSystem) return; // built-in statuses aren't deletable
  // Tasks/columns still on this status fall back to "К работе".
  await prisma.$transaction([
    prisma.task.updateMany({ where: { status: s.key }, data: { status: "todo" } }),
    prisma.column.updateMany({
      where: { statusKey: s.key },
      data: { statusKey: "todo" },
    }),
    prisma.statusDef.delete({ where: { id } }),
  ]);
  revalidatePath("/admin/statuses");
}
