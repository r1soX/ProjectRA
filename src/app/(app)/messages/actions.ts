"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { shortName } from "@/lib/names";
import {
  ensureDmChannel,
  ensureBoardChannel,
  canAccessChannel,
  markChannelRead,
  recipientsOfChannel,
} from "@/lib/chat";
import { publishChannel, publishUser } from "@/lib/realtime";

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

  // Notify open viewers of this channel.
  publishChannel(channelId);

  // Notify recipients personally (for toast + unread badge).
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { type: true, board: { select: { title: true } } },
  });
  const isBoard = channel?.type === "BOARD";
  const me2 = await prisma.user.findUniqueOrThrow({
    where: { id: me.id },
    select: { lastName: true, firstName: true, middleName: true },
  });
  const senderShort = shortName(me2);
  const payload = {
    type: "message" as const,
    channelId,
    fromName: senderShort,
    preview: body.length > 90 ? body.slice(0, 90) + "…" : body,
    title: isBoard ? (channel?.board?.title ?? "Доска") : senderShort,
    isBoard,
  };
  const recipients = await recipientsOfChannel(channelId, me.id);
  for (const uid of recipients) publishUser(uid, payload);

  revalidatePath("/messages");
  return { ok: true };
}

export async function markRead(channelId: string) {
  const me = await requireUser();
  if (!(await canAccessChannel(channelId, me.id))) return;
  await markChannelRead(channelId, me.id);
  revalidatePath("/messages");
}
