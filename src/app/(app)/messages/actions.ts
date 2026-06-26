"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  ensureDmChannel,
  ensureBoardChannel,
  canAccessChannel,
} from "@/lib/chat";
import { publishChannel } from "@/lib/realtime";

export type ChatState = { error?: string; ok?: boolean };

export async function openDm(otherUserId: string) {
  const me = await requireUser();
  const channelId = await ensureDmChannel(me.id, otherUserId);
  if (!channelId) redirect("/messages");
  redirect(`/messages?c=${channelId}`);
}

export async function openBoardChannel(boardId: string) {
  const me = await requireUser();
  const channelId = await ensureBoardChannel(boardId, me.id);
  if (!channelId) redirect("/messages");
  redirect(`/messages?c=${channelId}`);
}

const messageSchema = z.object({
  channelId: z.string().min(1),
  body: z.string().trim().min(1, "Введите сообщение").max(4000),
});

export async function sendMessage(
  _prev: ChatState,
  formData: FormData,
): Promise<ChatState> {
  const me = await requireUser();
  const parsed = messageSchema.safeParse({
    channelId: formData.get("channelId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { channelId, body } = parsed.data;
  if (!(await canAccessChannel(channelId, me.id))) {
    return { error: "Нет доступа к диалогу" };
  }

  await prisma.message.create({ data: { channelId, userId: me.id, body } });
  publishChannel(channelId);
  revalidatePath("/messages");
  return { ok: true };
}
