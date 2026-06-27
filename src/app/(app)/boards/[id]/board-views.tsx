"use client";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { PRIORITY_META, normalizePriority } from "@/lib/priority";
import { STATUS_META, normalizeStatus } from "@/lib/status";
import { isTaskOverdue, formatDue } from "./task-card-body";
import type { BoardColumn, BoardTask } from "./board-view";

function StatusDot({ status }: { status: string }) {
  const m = STATUS_META[normalizeStatus(status)];
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", m.dot)} />
      <span className="text-xs text-neutral-400">{m.label}</span>
    </span>
  );
}

function Assignees({ task }: { task: BoardTask }) {
  if (task.assignees.length === 0) return <span className="text-xs text-neutral-600">—</span>;
  return (
    <div className="flex -space-x-1.5">
      {task.assignees.slice(0, 3).map((a, i) => (
        <Avatar
          key={i}
          image={a.avatar}
          emoji={a.emoji}
          initials={a.initials}
          size={22}
          className="rounded-full ring-2 ring-neutral-950"
        />
      ))}
    </div>
  );
}

function isEmpty(columns: BoardColumn[]) {
  return columns.every((c) => c.tasks.length === 0);
}

// ── List view ──────────────────────────────────────────────────────────────

export function BoardListView({
  columns,
  onOpenTask,
}: {
  columns: BoardColumn[];
  onOpenTask: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {isEmpty(columns) && (
          <p className="py-16 text-center text-sm text-neutral-500">
            Нет задач по текущим фильтрам.
          </p>
        )}
        {columns.map(
          (col) =>
            col.tasks.length > 0 && (
              <div key={col.id}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-300">
                  {col.title}
                  <span className="rounded-full bg-white/10 px-1.5 text-xs text-neutral-400">
                    {col.tasks.length}
                  </span>
                </h3>
                <div className="overflow-hidden rounded-xl border border-white/[0.07]">
                  {col.tasks.map((t) => {
                    const pr = PRIORITY_META[normalizePriority(t.priority)];
                    return (
                      <button
                        key={t.id}
                        onClick={() => onOpenTask(t.id)}
                        className="flex w-full items-center gap-3 border-b border-white/[0.05] px-3 py-2.5 text-left transition last:border-b-0 hover:bg-white/[0.04]"
                      >
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_META[normalizeStatus(t.status)].dot)} />
                        <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">
                          {t.title}
                        </span>
                        {t.labels.slice(0, 2).map((l) => (
                          <span
                            key={l.id}
                            className="hidden shrink-0 rounded px-1.5 py-0.5 text-[11px] sm:inline"
                            style={{ backgroundColor: l.color + "33", color: l.color }}
                          >
                            {l.name}
                          </span>
                        ))}
                        <span className={cn("hidden shrink-0 items-center gap-1 text-[11px] sm:flex", pr.badge, "rounded px-1.5 py-0.5")}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", pr.dot)} />
                          {pr.label}
                        </span>
                        {t.dueDate && (
                          <span
                            className={cn(
                              "hidden shrink-0 text-xs sm:inline",
                              isTaskOverdue(t) ? "text-red-400" : "text-neutral-500",
                            )}
                          >
                            {formatDue(t.dueDate)}
                          </span>
                        )}
                        <Assignees task={t} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ),
        )}
      </div>
    </div>
  );
}

// ── Table view ─────────────────────────────────────────────────────────────

export function BoardTableView({
  columns,
  onOpenTask,
}: {
  columns: BoardColumn[];
  onOpenTask: (id: string) => void;
}) {
  const rows = columns.flatMap((c) =>
    c.tasks.map((t) => ({ task: t, column: c.title })),
  );

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-white/[0.07]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-3 py-2 font-medium">Задача</th>
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="px-3 py-2 font-medium">Колонка</th>
              <th className="px-3 py-2 font-medium">Приоритет</th>
              <th className="px-3 py-2 font-medium">Срок</th>
              <th className="px-3 py-2 font-medium">Исполнители</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-neutral-500">
                  Нет задач по текущим фильтрам.
                </td>
              </tr>
            )}
            {rows.map(({ task: t, column }) => {
              const pr = PRIORITY_META[normalizePriority(t.priority)];
              return (
                <tr
                  key={t.id}
                  onClick={() => onOpenTask(t.id)}
                  className="cursor-pointer border-b border-white/[0.05] transition last:border-b-0 hover:bg-white/[0.04]"
                >
                  <td className="max-w-xs truncate px-3 py-2.5 text-neutral-100">{t.title}</td>
                  <td className="px-3 py-2.5"><StatusDot status={t.status} /></td>
                  <td className="px-3 py-2.5 text-neutral-400">{column}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 text-neutral-300">
                      <span className={cn("h-1.5 w-1.5 rounded-full", pr.dot)} />
                      {pr.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {t.dueDate ? (
                      <span className={cn(isTaskOverdue(t) ? "text-red-400" : "text-neutral-400")}>
                        {formatDue(t.dueDate)}
                      </span>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5"><Assignees task={t} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
