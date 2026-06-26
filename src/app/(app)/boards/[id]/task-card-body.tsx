"use client";

import { CalendarClock, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BoardTask } from "./board-view";

function isOverdue(s: string) {
  const d = new Date(s);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function formatDue(s: string) {
  return new Date(s).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
  });
}

/** Inner content of a task card (without the outer border/bg wrapper). */
export function TaskCardBody({ task }: { task: BoardTask }) {
  return (
    <>
      {task.color && (
        <div className="h-1" style={{ backgroundColor: task.color }} />
      )}
      <div className="p-2.5">
        {task.labels.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {task.labels.map((l) => (
              <span
                key={l.id}
                className="rounded px-1.5 py-0.5 text-[10px]"
                style={{ backgroundColor: l.color + "33", color: l.color }}
              >
                {l.name}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-neutral-100">{task.title}</p>
        {(task.startDate || task.dueDate || task.assignees.length > 0) && (
          <div className="mt-2 flex items-center justify-between gap-2">
            {task.startDate || task.dueDate ? (
              <span
                className={cn(
                  "flex items-center gap-1 text-[11px]",
                  task.dueDate && isOverdue(task.dueDate)
                    ? "text-red-400"
                    : "text-neutral-400",
                )}
              >
                <CalendarClock className="h-3 w-3 shrink-0" />
                {task.startDate && <span>{formatDue(task.startDate)}</span>}
                {task.startDate && task.dueDate && (
                  <span className="text-neutral-600">→</span>
                )}
                {task.dueDate && <span>{formatDue(task.dueDate)}</span>}
              </span>
            ) : (
              <span />
            )}
            <div className="flex -space-x-1.5">
              {task.assignees.slice(0, 3).map((a, i) => (
                <span
                  key={i}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-neutral-800 bg-gradient-to-br from-sky-500 to-indigo-500 text-[9px] font-semibold text-white"
                >
                  {a.initials}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center gap-1 border-t border-neutral-700/50 pt-1.5 text-[10px] text-neutral-500">
          <UserCircle2 className="h-3 w-3 shrink-0" />
          Создал: <span className="text-neutral-400">{task.createdByName}</span>
        </div>
      </div>
    </>
  );
}
