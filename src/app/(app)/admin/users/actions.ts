"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireAdmin } from "@/lib/auth";

export type AdminState = { ok?: boolean; error?: string; message?: string };

const usernameRule = z
  .string()
  .trim()
  .min(3, "Минимум 3 символа")
  .regex(/^[a-zA-Z0-9._-]+$/, "Только латиница, цифры и . _ -");

const createSchema = z.object({
  username: usernameRule,
  name: z.string().trim().min(1, "Введите имя"),
  password: z.string().min(6, "Минимум 6 символов"),
  role: z.enum(["ADMIN", "USER"]),
});

export async function createUser(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    username: formData.get("username"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const { username, name, password, role } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return { error: "Логин уже занят" };

  await prisma.user.create({
    data: { username, name, role, passwordHash: await hashPassword(password) },
  });
  revalidatePath("/admin/users");
  return { ok: true, message: `Пользователь @${username} создан` };
}

export async function toggleActive(userId: string): Promise<void> {
  const admin = await requireAdmin();
  if (userId === admin.id) return; // can't block yourself
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });
  revalidatePath("/admin/users");
}

export async function setRole(
  userId: string,
  role: "ADMIN" | "USER",
): Promise<void> {
  const admin = await requireAdmin();
  if (userId === admin.id) return; // can't demote yourself
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}

const resetSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(6, "Минимум 6 символов"),
});

export async function resetPassword(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const parsed = resetSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  return { ok: true, message: "Пароль сброшен" };
}

export async function deleteUser(userId: string): Promise<void> {
  const admin = await requireAdmin();
  if (userId === admin.id) return; // can't delete yourself
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}
