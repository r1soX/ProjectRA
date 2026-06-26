"use client";

import { MessageCircle, LayoutGrid, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import { openDm, openBoardChannel } from "./actions";
import { ConversationView } from "./conversation-view";

export type ChatUser = {
  id: string;
  fullName: string;
  shortName: string;
  initials: string;
  username: string;
};
export type ChatBoard = { id: string; title: string; color: string };
export type ChatMessage = {
  id: string;
  body: string;
  mine: boolean;
  authorName: string;
  authorInitials: string;
  createdAt: string;
};
export type ActiveChannel = {
  channelId: string;
  type: string;
  title: string;
  subtitle: string;
  color: string | null;
  otherUserId: string | null;
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
  return (
    <div className="flex h-full min-h-0">
      {/* Conversation list */}
      <aside
        className={cn(
          "w-full flex-col border-r border-neutral-800 md:flex md:w-80",
          active ? "hidden md:flex" : "flex",
        )}
      >
        <div className="border-b border-neutral-800 px-4 py-3">
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
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-neutral-800/60",
                  active?.otherUserId === u.id && "bg-neutral-800",
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-semibold text-white">
                  {u.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-neutral-100">
                    {u.shortName}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    @{u.username}
                  </span>
                </span>
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
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-neutral-800/60",
                  active?.boardId === b.id && "bg-neutral-800",
                )}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: b.color }}
                >
                  #
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-neutral-100">
                    {b.title}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    чат доски
                  </span>
                </span>
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
          <ConversationView active={active} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-600">
            <MessagesSquare className="h-10 w-10" />
            <p className="text-sm">Выберите диалог или доску слева</p>
          </div>
        )}
      </section>
    </div>
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
