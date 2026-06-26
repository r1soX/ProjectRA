"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { sendMessage, markRead, type ChatState } from "./actions";
import type { ActiveChannel } from "./messages-client";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
  });
}

export function ConversationView({ active }: { active: ActiveChannel }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [state, action, pending] = useActionState<ChatState, FormData>(
    sendMessage,
    {},
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  // Live updates for this channel.
  useEffect(() => {
    const es = new EventSource(`/api/channels/${active.channelId}/stream`);
    es.addEventListener("change", () => router.refresh());
    return () => es.close();
  }, [active.channelId, router]);

  // Mark the conversation read on open and whenever new messages arrive.
  useEffect(() => {
    markRead(active.channelId);
  }, [active.channelId, active.messages.length]);

  // Clear input after a successful send.
  useEffect(() => {
    if (state.ok) setBody("");
  }, [state]);

  // Scroll to newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [active.messages.length, active.channelId]);

  const isBoard = active.type === "BOARD";
  let lastDay = "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
        <Link
          href="/messages"
          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{
            background: isBoard
              ? (active.color ?? "#0ea5e9")
              : "linear-gradient(135deg,#0ea5e9,#6366f1)",
          }}
        >
          {isBoard ? "#" : active.title.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-100">
            {active.title}
          </p>
          {active.subtitle && (
            <p className="truncate text-xs text-neutral-500">
              {active.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-4 py-4">
        {active.messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-neutral-500">
            Сообщений пока нет. Начните разговор 👋
          </p>
        )}
        {active.messages.map((m) => {
          const day = formatDay(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-3 text-center">
                  <span className="rounded-full bg-neutral-800 px-3 py-0.5 text-xs text-neutral-400">
                    {day}
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "flex items-end gap-2",
                  m.mine ? "justify-end" : "justify-start",
                )}
              >
                {!m.mine && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-[10px] font-semibold text-white">
                    {m.authorInitials}
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3 py-2",
                    m.mine
                      ? "rounded-br-sm bg-sky-600 text-white"
                      : "rounded-bl-sm bg-neutral-800 text-neutral-100",
                  )}
                >
                  {!m.mine && isBoard && (
                    <p className="mb-0.5 text-xs font-medium text-sky-300">
                      {m.authorName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {m.body}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-right text-[10px]",
                      m.mine ? "text-sky-200/80" : "text-neutral-500",
                    )}
                  >
                    {formatTime(m.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        action={action}
        className="flex items-end gap-2 border-t border-neutral-800 p-3"
      >
        <input type="hidden" name="channelId" value={active.channelId} />
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (body.trim()) e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          placeholder="Сообщение…"
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
        />
        <Button type="submit" loading={pending} disabled={!body.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
