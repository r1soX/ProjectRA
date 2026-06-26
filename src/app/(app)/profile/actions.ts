"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireUser } from "@/lib/auth";

export type FormState = { ok?: boolean; error?: string; message?: string };

const profileSchema = z.object({
  name: z.string().trim().min(1, "Введите имя"),
});

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireUser();
  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { name: parsed.data.name },
  });
  revalidatePath("/profile");
  return { ok: true, message: "Имя обновлено" };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Введите текущий пароль"),
    next: z.string().min(6, "Минимум 6 символов"),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, {
    message: "Пароли не совпадают",
    path: ["confirm"],
  });

export async function changePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireUser();
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return { error: "Пользователь не найден" };

  const valid = await verifyPassword(parsed.data.current, user.passwordHash);
  if (!valid) return { error: "Текущий пароль неверный" };

  await prisma.user.update({
    where: { id: session.id },
    data: { passwordHash: await hashPassword(parsed.data.next) },
  });
  return { ok: true, message: "Пароль изменён" };
}
