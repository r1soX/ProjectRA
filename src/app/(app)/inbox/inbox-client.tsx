"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Inbox, Check, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { notifMeta, formatRelative, type NotifType } from "@/lib/notif-format";

export type InboxNotif = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export function InboxClient({ initial }: { initial: InboxNotif[] }) {
  const router = useRouter();
  const [notifs, setNotifs] = useState<InboxNotif[]>(initial);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const unread = notifs.filter((n) => !n.isRead).length;
  const shown = tab === "unread" ? notifs.filter((n) => !n.isRead) : notifs;

  async function markRead(id?: string) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    setNotifs((ns) =>
      ns.map((n) => (id ? (n.id === id ? { ...n, isRead: true } : n) : { ...n, isRead: true })),
    );
  }

  async function clearAll() {
    setNotifs([]);
    await fetch("/api/notifications/clear", { method: "POST" });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Входящие</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {unread > 0 ? `${unread} непрочитанных` : "Всё прочитано"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={() => markRead()}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 transition hover:bg-neutral-700"
            >
              <Check className="h-4 w-4" />
              Прочитать все
            </button>
          )}
          {notifs.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-400 transition hover:bg-neutral-700 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              Очистить
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex w-fit gap-1 rounded-xl bg-neutral-900/60 p-1">
        {(["all", "unread"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition",
              tab === t ? "bg-white/10 text-neutral-100" : "text-neutral-500 hover:text-neutral-300",
            )}
          >
            {t === "all" ? "Все" : `Непрочитанные${unread ? ` · ${unread}` : ""}`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tab === "unread" ? "Нет непрочитанных" : "Входящие пусты"}
          description="Здесь появятся упоминания, назначения и дедлайны."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
          <AnimatePresence initial={false}>
            {shown.map((n) => {
              const meta = notifMeta(n.type as NotifType, n.payload);
              const Icon = meta.icon;
              return (
                <motion.button
                  key={n.id}
                  layout
                  exit={{ opacity: 0 }}
                  onClick={() => {
                    if (!n.isRead) markRead(n.id);
                    if (n.link) router.push(n.link);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-white/[0.05] px-4 py-3 text-left transition last:border-b-0 hover:bg-white/[0.04]",
                    !n.isRead && "bg-sky-500/[0.05]",
                  )}
                >
                  <span className={cn("mt-0.5 shrink-0", meta.color)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-100">{meta.title}</p>
                    <p className="text-sm text-neutral-400">{meta.body}</p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      {formatRelative(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
