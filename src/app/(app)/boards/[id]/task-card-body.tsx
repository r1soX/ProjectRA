"use client";

import {
  CalendarClock,
  UserCircle2,
  MessageSquare,
  Share2,
  Lock,
  AlertTriangle,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { PRIORITY_META, normalizePriority } from "@/lib/priority";
import { ruleFromTask, describeRecurrence } from "@/lib/recurrence";
import type { BoardTask } from "./board-view";

function isOverdue(s: string) {
  const d = new Date(s);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

/** True when the task has a due date in the past. */
export function isTaskOverdue(task: { dueDate: string | null }) {
  return task.dueDate ? isOverdue(task.dueDate) : false;
}

export function formatDue(s: string) {
  return new Date(s).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
  });
}

/** Inner content of a task card (without the outer border/bg wrapper). */
export function TaskCardBody({ task }: { task: BoardTask }) {
  const priority = PRIORITY_META[normalizePriority(task.priority)];
  return (
    <>
      <div
        className="h-1"
        style={{ backgroundColor: task.color ?? priority.bar }}
      />
      <div className="p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {isTaskOverdue(task) && (
            <span className="inline-flex animate-pulse items-center gap-1 rounded bg-red-500/25 px-1.5 py-0.5 text-[11px] font-bold uppercase text-red-300 ring-1 ring-red-500/50">
              <AlertTriangle className="h-3 w-3" />
              просрочено
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
              priority.badge,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", priority.dot)} />
            {priority.label}
          </span>
          {task.isPersonal && (
            <span className="inline-flex items-center gap-1 rounded bg-neutral-700/60 px-1.5 py-0.5 text-[11px] text-neutral-300">
              <Lock className="h-3 w-3" />
              личная
            </span>
          )}
          {(() => {
            const rule = ruleFromTask(task);
            return rule ? (
              <span className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[11px] text-violet-300">
                <Repeat className="h-3 w-3" />
                {describeRecurrence(rule)}
              </span>
            ) : null;
          })()}
          {task.labels.map((l) => (
            <span
              key={l.id}
              className="rounded px-1.5 py-0.5 text-[11px]"
              style={{ backgroundColor: l.color + "33", color: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
        <p className="break-words text-[15px] leading-snug text-neutral-100 sm:text-sm">
          {task.title}
        </p>
        {(task.startDate ||
          task.dueDate ||
          task.assignees.length > 0 ||
          task.comments.length > 0 ||
          task.links.length > 0) && (
          <div className="mt-2.5 flex items-center justify-between gap-2">
            {task.startDate || task.dueDate ? (
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1 truncate text-xs",
                  task.dueDate && isOverdue(task.dueDate)
                    ? "text-red-400"
                    : "text-neutral-400",
                )}
              >
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                {task.startDate && <span>{formatDue(task.startDate)}</span>}
                {task.startDate && task.dueDate && (
                  <span className="text-neutral-600">→</span>
                )}
                {task.dueDate && <span>{formatDue(task.dueDate)}</span>}
              </span>
            ) : (
              <span />
            )}
            <div className="flex shrink-0 items-center gap-2.5">
              {task.links.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-neutral-400">
                  <Share2 className="h-3.5 w-3.5" />
                  {task.links.length}
                </span>
              )}
              {task.comments.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-neutral-400">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {task.comments.length}
                </span>
              )}
              <div className="flex -space-x-1.5">
                {task.assignees.slice(0, 3).map((a, i) => (
                  <Avatar
                    key={i}
                    image={a.avatar}
                    emoji={a.emoji}
                    initials={a.initials}
                    size={24}
                    className="rounded-full ring-2 ring-neutral-950"
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="mt-2.5 flex min-w-0 items-center gap-1 border-t border-neutral-700/50 pt-2 text-[11px] text-neutral-500">
          <UserCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="shrink-0">Создал:</span>
          <span className="truncate text-neutral-400">{task.createdByName}</span>
        </div>
      </div>
    </>
  );
}
