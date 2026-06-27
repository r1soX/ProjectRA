"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  setRolePerm,
  setUserPerm,
  getRolePermMap,
  invalidatePermCache,
  PERMS,
  type PermKey,
} from "@/lib/permissions";
import type { PermTemplateKey } from "@/lib/perm-templates";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Нет прав");
  return user;
}

export async function updateRolePerm(
  role: string,
  perm: string,
  granted: boolean | null,
) {
  await requireAdmin();
  await setRolePerm(role, perm as PermKey, granted);
  revalidatePath("/admin/permissions");
}

export async function updateUserPerm(
  userId: string,
  perm: string,
  granted: boolean | null,
) {
  await requireAdmin();
  await setUserPerm(userId, perm as PermKey, granted);
  revalidatePath("/admin/permissions");
}

// Predefined permission sets for templates
const TEMPLATE_PERMS: Record<PermTemplateKey, Set<string>> = {
  observer: new Set([
    PERMS.BOARD_VIEW,
    PERMS.TASK_VIEW,
    PERMS.COMMENT_VIEW,
    PERMS.MESSAGE_VIEW,
    PERMS.FILE_VIEW,
    PERMS.TIME_VIEW_OWN,
  ]),
  executor: new Set([
    PERMS.BOARD_VIEW,
    PERMS.TASK_VIEW, PERMS.TASK_CREATE, PERMS.TASK_EDIT_OWN,
    PERMS.TASK_DELETE_OWN, PERMS.TASK_MOVE, PERMS.TASK_COMPLETE, PERMS.TASK_ASSIGN,
    PERMS.COMMENT_VIEW, PERMS.COMMENT_CREATE,
    PERMS.COMMENT_EDIT_OWN, PERMS.COMMENT_DELETE_OWN,
    PERMS.MESSAGE_VIEW, PERMS.MESSAGE_SEND,
    PERMS.MESSAGE_EDIT_OWN, PERMS.MESSAGE_DELETE_OWN,
    PERMS.FILE_VIEW, PERMS.FILE_UPLOAD,
    PERMS.TIME_LOG, PERMS.TIME_VIEW_OWN, PERMS.TIME_EDIT_OWN, PERMS.TIME_DELETE_OWN,
  ]),
  manager: new Set([
    PERMS.BOARD_VIEW, PERMS.BOARD_CREATE, PERMS.BOARD_EDIT,
    PERMS.BOARD_DELETE, PERMS.BOARD_MANAGE_MEMBERS,
    PERMS.TASK_VIEW, PERMS.TASK_CREATE, PERMS.TASK_EDIT_OWN, PERMS.TASK_EDIT_ANY,
    PERMS.TASK_DELETE_OWN, PERMS.TASK_MOVE, PERMS.TASK_COMPLETE, PERMS.TASK_ASSIGN,
    PERMS.COMMENT_VIEW, PERMS.COMMENT_CREATE,
    PERMS.COMMENT_EDIT_OWN, PERMS.COMMENT_DELETE_OWN,
    PERMS.MESSAGE_VIEW, PERMS.MESSAGE_SEND,
    PERMS.MESSAGE_EDIT_OWN, PERMS.MESSAGE_DELETE_OWN,
    PERMS.FILE_VIEW, PERMS.FILE_UPLOAD,
    PERMS.TIME_LOG, PERMS.TIME_VIEW_OWN, PERMS.TIME_EDIT_OWN, PERMS.TIME_DELETE_OWN,
    PERMS.COLUMN_CREATE, PERMS.COLUMN_EDIT, PERMS.COLUMN_DELETE,
    PERMS.LABEL_CREATE, PERMS.LABEL_EDIT, PERMS.LABEL_DELETE,
  ]),
};

export async function applyPermTemplate(
  userId: string,
  userRole: string,
  templateKey: PermTemplateKey,
): Promise<{ permMap: Record<string, boolean> }> {
  await requireAdmin();

  const templateSet = TEMPLATE_PERMS[templateKey];
  const roleMap = await getRolePermMap(userRole);

  // Delete all existing user-level overrides
  await prisma.userPermission.deleteMany({ where: { userId } });

  // Apply overrides only where template differs from role default
  const allPerms = Object.values(PERMS) as string[];
  const overrides = allPerms
    .filter((p) => templateSet.has(p) !== !!roleMap[p as PermKey])
    .map((p) => ({ userId, perm: p, granted: templateSet.has(p) }));

  if (overrides.length > 0) {
    await prisma.userPermission.createMany({ data: overrides });
  }

  invalidatePermCache(userId);

  // Return new effective permission map
  const newMap = Object.fromEntries(
    allPerms.map((p) => [p, templateSet.has(p)])
  ) as Record<string, boolean>;

  revalidatePath("/admin/permissions");
  return { permMap: newMap };
}
