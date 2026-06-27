"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { shortName } from "@/lib/names";
import { hasPerm, PERMS } from "@/lib/permissions";
import {
  ensureDmChannel,
  ensureBoardChannel,
  canAccessChannel,
  markChannelRead,
  recipientsOfChannel,
} from "@/lib/chat";
import { publishChannel, publishUser } from "@/lib/realtime";
import { notifyMentionsInMessage } from "@/lib/notify";

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

export async function sendMessage(
  _prev: ChatState,
  formData: FormData,
): Promise<ChatState> {
  const me = await requireUser();
  const channelId = String(formData.get("channelId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const attachmentUrl = String(formData.get("attachmentUrl") ?? "") || null;
  const attachmentType = String(formData.get("attachmentType") ?? "") || null;
  const attachmentName = String(formData.get("attachmentName") ?? "") || null;
  const attachmentSizeRaw = String(formData.get("attachmentSize") ?? "");
  const attachmentSize = attachmentSizeRaw ? parseInt(attachmentSizeRaw, 10) : null;

  if (!channelId) return { error: "Нет диалога" };
  if (!body && !attachmentUrl) return { error: "Введите сообщение" };
  if (!(await canAccessChannel(channelId, me.id))) {
    return { error: "Нет доступа к диалогу" };
  }
  if (!(await hasPerm(me.id, me.role, PERMS.MESSAGE_SEND))) {
    return { error: "Недостаточно прав" };
  }

  await prisma.message.create({
    data: {
      channelId,
      userId: me.id,
      body,
      attachmentUrl,
      attachmentType,
      attachmentName,
      attachmentSize,
    },
  });

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
  const previewText = body
    ? body.length > 90
      ? body.slice(0, 90) + "…"
      : body
    : attachmentType === "image"
      ? "📷 Фото"
      : attachmentType === "video"
        ? "🎬 Видео"
        : "📎 Файл";
  const payload = {
    type: "message" as const,
    channelId,
    fromName: senderShort,
    preview: previewText,
    title: isBoard ? (channel?.board?.title ?? "Доска") : senderShort,
    isBoard,
  };
  const recipients = await recipientsOfChannel(channelId, me.id);
  for (const uid of recipients) publishUser(uid, payload);

  // @-mentions
  if (body) {
    const channelTitle = isBoard ? (channel?.board?.title ?? "Доска") : senderShort;
    await notifyMentionsInMessage(body, me.id, senderShort, channelId, channelTitle);
  }

  revalidatePath("/messages");
  return { ok: true };
}

export async function markRead(channelId: string) {
  const me = await requireUser();
  if (!(await canAccessChannel(channelId, me.id))) return;
  await markChannelRead(channelId, me.id);
  revalidatePath("/messages");
}

export async function editMessage(messageId: string, body: string) {
  const me = await requireUser();
  const text = body.trim().slice(0, 4000);
  if (!text) return;
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { userId: true, channelId: true },
  });
  if (!msg || msg.userId !== me.id) return;
  if (!(await hasPerm(me.id, me.role, PERMS.MESSAGE_EDIT_OWN))) return;
  await prisma.message.update({
    where: { id: messageId },
    data: { body: text, editedAt: new Date() },
  });
  publishChannel(msg.channelId);
  revalidatePath("/messages");
}

export async function deleteMessage(messageId: string) {
  const me = await requireUser();
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { userId: true, channelId: true },
  });
  if (!msg) return;
  const delAny = await hasPerm(me.id, me.role, PERMS.MESSAGE_DELETE_ANY);
  const delOwn = await hasPerm(me.id, me.role, PERMS.MESSAGE_DELETE_OWN);
  if (!delAny && !(delOwn && msg.userId === me.id)) return;
  await prisma.message.delete({ where: { id: messageId } });
  publishChannel(msg.channelId);
  revalidatePath("/messages");
}
