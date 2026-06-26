import { requireUser } from "@/lib/auth";
import { getConversationList, getChannelView, getUnread } from "@/lib/chat";
import { fullName, shortName, initials } from "@/lib/names";
import {
  MessagesClient,
  type ChatBoard,
  type ChatUser,
  type ActiveChannel,
} from "./messages-client";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const me = await requireUser();
  const { c } = await searchParams;

  const [{ users, boards }, unread] = await Promise.all([
    getConversationList(me.id),
    getUnread(me.id),
  ]);

  let active: ActiveChannel | null = null;
  if (c) {
    const channel = await getChannelView(c, me.id);
    if (channel) {
      const isDm = channel.type === "DM";
      const other = isDm
        ? channel.members.find((m) => m.userId !== me.id)?.user
        : null;

      active = {
        channelId: channel.id,
        type: channel.type,
        title: isDm
          ? other
            ? fullName(other)
            : "Диалог"
          : (channel.board?.title ?? channel.name),
        subtitle: isDm
          ? other
            ? `@${other.username}`
            : ""
          : "Чат доски",
        color: channel.board?.color ?? null,
        otherUserId: other?.id ?? null,
        boardId: channel.boardId ?? null,
        messages: channel.messages.map((msg) => ({
          id: msg.id,
          body: msg.body,
          mine: msg.userId === me.id,
          authorName: shortName(msg.user),
          authorInitials: initials(msg.user),
          createdAt: msg.createdAt.toISOString(),
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
    unread: byUser[u.id] ?? 0,
  }));
  const chatBoards: ChatBoard[] = boards.map((b) => ({
    id: b.id,
    title: b.title,
    color: b.color ?? "#0ea5e9",
    unread: byBoard[b.id] ?? 0,
  }));

  return (
    <MessagesClient users={chatUsers} boards={chatBoards} active={active} />
  );
}
