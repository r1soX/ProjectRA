"use server";

import { requireUser } from "@/lib/auth";
import { setRolePerm, setUserPerm, type PermKey } from "@/lib/permissions";
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
