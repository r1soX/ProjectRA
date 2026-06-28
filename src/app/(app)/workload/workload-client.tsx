"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Check,
  Users as UsersIcon,
} from "lucide-react";
import { PRIORITY_META, normalizePriority } from "@/lib/priority";

type TaskEntry = {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  boardId: string;
  boardTitle: string;
  columnTitle: string;
  isOverdue: boolean;
  confirmed: boolean;
  confirmedCount: number;
  assigneeCount: number;
};

type UserEntry = {
  id: string;
  fullName: string;
  initials: string;
  avatar: string | null;
  emoji: string | null;
  role: string;
  taskCount: number;
  doneCount: number;
  overdueCount: number;
  tasks: TaskEntry[];
};

function UserRow({ user, currentUserId }: { user: UserEntry; currentUserId: string }) {
  const [open, setOpen] = useState(user.id === currentUserId);
  const pr = PRIORITY_META;

  const load = user.taskCount === 0 ? "empty" : user.taskCount <= 3 ? "ok" : user.taskCount <= 6 ? "medium" : "high";
  const loadColor = {
    empty: "bg-neutral-800",
    ok: "bg-emerald-500",
    medium: "bg-amber-500",
    high: "bg-red-500",
  }[load];

  return (
    <div className="rounded-xl border border-white/[0.07] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
      >
        <Avatar
          image={user.avatar}
          emoji={user.emoji}
          initials={user.initials}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-100">
            {user.fullName}
            {user.id === currentUserId && (
              <span className="ml-2 text-xs text-sky-400">(вы)</span>
            )}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-neutral-800">
              <div
                className={cn("h-full rounded-full transition-all", loadColor)}
                style={{ width: `${Math.min(100, (user.taskCount / 8) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] text-neutral-500">
              {user.taskCount} в работе
              {user.doneCount > 0 && (
                <span className="ml-1.5 text-emerald-400">· {user.doneCount} готово</span>
              )}
              {user.overdueCount > 0 && (
                <span className="ml-1.5 text-red-400">· {user.overdueCount} просрочено</span>
              )}
            </span>
          </div>
        </div>
        {user.overdueCount > 0 && (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
        )}
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-neutral-600" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-600" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/[0.07]">
          {user.tasks.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-neutral-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Нет активных задач
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {user.tasks.map((t) => {
                const p = pr[normalizePriority(t.priority)];
                const allDone = t.confirmedCount === t.assigneeCount;
                return (
                  <Link
                    key={t.id}
                    href={`/boards/${t.boardId}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.03]",
                      t.confirmed && "opacity-60",
                    )}
                  >
                    {t.confirmed ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", p.dot)} />
                    )}
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        t.confirmed
                          ? "text-neutral-500 line-through"
                          : t.isOverdue
                            ? "text-red-300"
                            : "text-neutral-200",
                      )}
                    >
                      {t.title}
                    </span>
                    {t.assigneeCount > 1 && (
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                          allDone
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/[0.06] text-neutral-400",
                        )}
                        title={`Подтвердили ${t.confirmedCount} из ${t.assigneeCount} исполнителей`}
                      >
                        <UsersIcon className="h-3 w-3" />
                        {t.confirmedCount}/{t.assigneeCount}
                      </span>
                    )}
                    <span className="hidden shrink-0 text-[11px] text-neutral-600 sm:inline">
                      {t.boardTitle} · {t.columnTitle}
                    </span>
                    {t.dueDate && (
                      <span
                        className={cn(
                          "shrink-0 text-[11px]",
                          t.confirmed
                            ? "text-neutral-600"
                            : t.isOverdue
                              ? "text-red-400"
                              : "text-neutral-500",
                        )}
                      >
                        {new Date(t.dueDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkloadClient({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: UserEntry[];
}) {
  const [sortBy, setSortBy] = useState<"name" | "load" | "overdue">("load");

  const sorted = [...users].sort((a, b) => {
    if (sortBy === "load") return b.taskCount - a.taskCount;
    if (sortBy === "overdue") return b.overdueCount - a.overdueCount;
    return a.fullName.localeCompare(b.fullName, "ru");
  });

  const totalTasks = users.reduce((s, u) => s + u.taskCount, 0);
  const totalOverdue = users.reduce((s, u) => s + u.overdueCount, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold text-neutral-100">Загрузка команды</h1>
      <p className="mb-6 text-sm text-neutral-500">
        {totalTasks} активных задач · {totalOverdue > 0 ? <span className="text-red-400">{totalOverdue} просрочено</span> : "нет просрочек"}
      </p>

      {/* Sort controls */}
      <div className="mb-4 flex gap-1 rounded-xl bg-neutral-900/60 p-1 w-fit text-sm">
        {(["load", "overdue", "name"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={cn(
              "rounded-lg px-3 py-1.5 font-medium transition",
              sortBy === s ? "bg-white/10 text-neutral-100" : "text-neutral-500 hover:text-neutral-300",
            )}
          >
            {s === "load" ? "По нагрузке" : s === "overdue" ? "По просрочкам" : "По имени"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.map((u) => (
          <UserRow key={u.id} user={u} currentUserId={currentUserId} />
        ))}
      </div>
    </div>
  );
}
