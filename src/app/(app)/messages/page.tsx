import { requireUser } from "@/lib/auth";
import {
  getConversationList,
  getChannelView,
  getUnread,
  getAllDmChannels,
} from "@/lib/chat";
import { hasPerm, PERMS } from "@/lib/permissions";
import { AccessDenied } from "@/components/ui/access-denied";
import { fullName, shortName, initials } from "@/lib/names";
import {
  MessagesClient,
  type ChatBoard,
  type ChatUser,
  type ActiveChannel,
  type SpectateChannel,
} from "./messages-client";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const me = await requireUser();
  if (!(await hasPerm(me.id, me.role, PERMS.MESSAGE_VIEW))) {
    return (
      <AccessDenied message="У вас нет прав на просмотр сообщений. Если это ошибка — обратитесь к администратору." />
    );
  }
  const { c } = await searchParams;
  const [canViewAny, canViewAllBoards] = await Promise.all([
    hasPerm(me.id, me.role, PERMS.MESSAGE_VIEW_ANY),
    hasPerm(me.id, me.role, PERMS.BOARD_VIEW_ALL),
  ]);

  const [{ users, boards }, unread] = await Promise.all([
    getConversationList(me.id, canViewAllBoards),
    getUnread(me.id),
  ]);

  // Surveillance (MESSAGE_VIEW_ANY): every DM between other people, "A ↔ B".
  let spectate: SpectateChannel[] = [];
  if (canViewAny) {
    const dms = await getAllDmChannels();
    spectate = dms
      .filter(
        (ch) =>
          ch.members.length === 2 &&
          !ch.members.some((m) => m.userId === me.id),
      )
      .map((ch) => ({
        channelId: ch.id,
        title: ch.members.map((m) => shortName(m.user)).join(" ↔ "),
      }));
  }

  let active: ActiveChannel | null = null;
  if (c) {
    const channel = await getChannelView(c, me.id);
    if (channel) {
      const isDm = channel.type === "DM";
      const iAmMember = channel.members.some((m) => m.userId === me.id);
      // Admin viewing a DM they're not part of → read-only spectator view.
      const spectating = isDm && !iAmMember;
      const other =
        isDm && iAmMember
          ? channel.members.find((m) => m.userId !== me.id)?.user
          : null;

      active = {
        channelId: channel.id,
        type: channel.type,
        title: isDm
          ? spectating
            ? channel.members.map((m) => shortName(m.user)).join(" ↔ ")
            : other
              ? fullName(other)
              : "Диалог"
          : (channel.board?.title ?? channel.name),
        subtitle: isDm
          ? spectating
            ? "переписка пользователей"
            : other
              ? `@${other.username}`
              : ""
          : "Чат доски",
        color: channel.board?.color ?? null,
        otherUserId: other?.id ?? null,
        otherAvatar: other?.avatar ?? null,
        otherEmoji: other?.avatarEmoji ?? null,
        otherLastSeen: other?.lastSeenAt ? other.lastSeenAt.toISOString() : null,
        boardId: channel.boardId ?? null,
        readOnly: spectating,
        messages: channel.messages.map((msg) => ({
          id: msg.id,
          body: msg.body,
          mine: msg.userId === me.id,
          userId: msg.userId,
          authorName: shortName(msg.user),
          authorInitials: initials(msg.user),
          authorAvatar: msg.user.avatar ?? null,
          authorEmoji: msg.user.avatarEmoji ?? null,
          createdAt: msg.createdAt.toISOString(),
          editedAt: msg.editedAt ? msg.editedAt.toISOString() : null,
          attachmentUrl: msg.attachmentUrl ?? null,
          attachmentType: msg.attachmentType ?? null,
          attachmentName: msg.attachmentName ?? null,
          attachmentSize: msg.attachmentSize ?? null,
        })),
      };
    }
  }

  // The conversation being viewed is considered read in the list.
  const byUser = { ...unread.byUser };
  const byBoard = { ...unread.byBoard };
  if (active?.otherUserId) byUser[active.otherUserId] = 0;
  if (active?.boardId) byBoard[active.boardId] = 0;

  const chatUsers: ChatUser[] = users.map((u) => ({
    id: u.id,
    fullName: fullName(u),
    shortName: shortName(u),
    initials: initials(u),
    username: u.username,
    avatar: u.avatar ?? null,
    emoji: u.avatarEmoji ?? null,
    lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
    unread: byUser[u.id] ?? 0,
  }));
  const chatBoards: ChatBoard[] = boards.map((b) => ({
    id: b.id,
    title: b.title,
    color: b.color ?? "#0ea5e9",
    unread: byBoard[b.id] ?? 0,
  }));

  return (
    <MessagesClient
      users={chatUsers}
      boards={chatBoards}
      spectate={spectate}
      active={active}
    />
  );
}
