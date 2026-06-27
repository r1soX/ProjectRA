"use client";

import { MessageCircle, LayoutGrid, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { usePresence, onlineFromState } from "@/components/presence-provider";
import { openDm, openBoardChannel } from "./actions";
import { ConversationView } from "./conversation-view";

export type ChatUser = {
  id: string;
  fullName: string;
  shortName: string;
  initials: string;
  username: string;
  avatar: string | null;
  emoji: string | null;
  lastSeenAt: string | null;
  unread: number;
};
export type ChatBoard = {
  id: string;
  title: string;
  color: string;
  unread: number;
};
export type ChatMessage = {
  id: string;
  body: string;
  mine: boolean;
  userId: string;
  authorName: string;
  authorInitials: string;
  authorAvatar: string | null;
  authorEmoji: string | null;
  createdAt: string;
  editedAt: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
};
export type ActiveChannel = {
  channelId: string;
  type: string;
  title: string;
  subtitle: string;
  color: string | null;
  otherUserId: string | null;
  otherAvatar: string | null;
  otherEmoji: string | null;
  otherLastSeen: string | null;
  boardId: string | null;
  messages: ChatMessage[];
};

export function MessagesClient({
  users,
  boards,
  active,
}: {
  users: ChatUser[];
  boards: ChatBoard[];
  active: ActiveChannel | null;
}) {
  const presence = usePresence();
  return (
    <div className="flex h-full min-h-0">
      {/* Conversation list */}
      <aside
        className={cn(
          "w-full flex-col border-r border-white/10 md:flex md:w-80",
          active ? "hidden md:flex" : "flex",
        )}
      >
        <div className="border-b border-white/10 px-4 py-3">
          <h1 className="text-lg font-bold text-neutral-100">Сообщения</h1>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
          <Section icon={MessageCircle} label="Личные сообщения" />
          {users.length === 0 && (
            <p className="px-3 py-2 text-xs text-neutral-600">
              Других пользователей нет
            </p>
          )}
          {users.map((u) => (
            <form key={u.id} action={openDm.bind(null, u.id)}>
              <button
                type="submit"
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/5",
                  active?.otherUserId === u.id && "bg-white/10",
                )}
              >
                <Avatar
                  image={u.avatar}
                  emoji={u.emoji}
                  initials={u.initials}
                  size={36}
                  online={onlineFromState(presence, u.id, u.lastSeenAt)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-neutral-100">
                    {u.shortName}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    {onlineFromState(presence, u.id, u.lastSeenAt)
                      ? "в сети"
                      : `@${u.username}`}
                  </span>
                </span>
                <UnreadBadge n={u.unread} />
              </button>
            </form>
          ))}

          <div className="mt-2">
            <Section icon={LayoutGrid} label="Доски" />
          </div>
          {boards.length === 0 && (
            <p className="px-3 py-2 text-xs text-neutral-600">Нет досок</p>
          )}
          {boards.map((b) => (
            <form key={b.id} action={openBoardChannel.bind(null, b.id)}>
              <button
                type="submit"
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/5",
                  active?.boardId === b.id && "bg-white/10",
                )}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: b.color }}
                >
                  #
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-neutral-100">
                    {b.title}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    чат доски
                  </span>
                </span>
                <UnreadBadge n={b.unread} />
              </button>
            </form>
          ))}
        </div>
      </aside>

      {/* Conversation */}
      <section
        className={cn(
          "min-w-0 flex-1",
          active ? "block" : "hidden md:block",
        )}
      >
        {active ? (
          <ConversationView active={active} users={users} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={MessagesSquare}
              title="Выберите диалог"
              description="Слева — личные сообщения и чаты досок. Откройте любой, чтобы начать общение."
            />
          </div>
        )}
      </section>
    </div>
  );
}

function UnreadBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 px-1.5 text-xs font-semibold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}

function Section({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}
