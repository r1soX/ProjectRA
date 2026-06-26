"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireUser } from "@/lib/auth";

export type FormState = { ok?: boolean; error?: string; message?: string };

export async function saveAvatar(
  avatar: string | null,
  avatarEmoji: string | null,
) {
  const me = await requireUser();
  await prisma.user.update({
    where: { id: me.id },
    data: { avatar, avatarEmoji },
  });
  revalidatePath("/profile");
}

const profileSchema = z.object({
  lastName: z.string().trim().min(1, "Введите фамилию"),
  firstName: z.string().trim().min(1, "Введите имя"),
  middleName: z.string().trim().optional(),
  birthDate: z.string().trim().optional(),
});

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireUser();
  const parsed = profileSchema.safeParse({
    lastName: formData.get("lastName"),
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName"),
    birthDate: formData.get("birthDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const { lastName, firstName, middleName, birthDate } = parsed.data;
  await prisma.user.update({
    where: { id: session.id },
    data: {
      lastName,
      firstName,
      middleName: middleName || null,
      birthDate: birthDate ? new Date(birthDate) : null,
    },
  });
  revalidatePath("/profile");
  return { ok: true, message: "Профиль обновлён" };
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
