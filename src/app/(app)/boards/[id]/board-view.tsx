"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users as UsersIcon,
  Lock,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  createColumn,
  renameColumn,
  deleteColumn,
  createTask,
  updateBoard,
  deleteBoard,
} from "../actions";
import { TaskModal } from "./task-modal";
import { MembersModal } from "./members-modal";

export type BoardMemberView = {
  userId: string;
  role: string;
  shortName: string;
  initials: string;
  username: string;
};
export type DirectoryUser = {
  id: string;
  fullName: string;
  username: string;
  initials: string;
};
export type BoardTask = {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  color: string | null;
  startDate: string | null;
  dueDate: string | null;
  assigneeIds: string[];
  assignees: { initials: string; shortName: string }[];
  labels: { id: string; name: string; color: string }[];
};
export type BoardColumn = { id: string; title: string; tasks: BoardTask[] };

function formatDue(s: string) {
  return new Date(s).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
  });
}
function isOverdue(s: string) {
  const d = new Date(s);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function BoardView({
  boardId,
  title,
  color,
  isPersonal,
  role,
  columns,
  members,
  directory,
}: {
  boardId: string;
  title: string;
  color: string;
  isPersonal: boolean;
  role: string;
  columns: BoardColumn[];
  members: BoardMemberView[];
  directory: DirectoryUser[];
}) {
  const canEdit = role === "OWNER" || role === "EDITOR";
  const isOwner = role === "OWNER";

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [, start] = useTransition();

  const selectedTask = useMemo(
    () =>
      columns.flatMap((c) => c.tasks).find((t) => t.id === selectedTaskId) ??
      null,
    [columns, selectedTaskId],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-3 sm:px-6">
        <Link
          href="/boards"
          className="rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        <h1 className="text-lg font-bold text-neutral-100">{title}</h1>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
            isPersonal
              ? "bg-neutral-800 text-neutral-400"
              : "bg-sky-500/15 text-sky-300",
          )}
        >
          {isPersonal ? <Lock className="h-3 w-3" /> : <UsersIcon className="h-3 w-3" />}
          {isPersonal ? "личная" : "общая"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {members.length > 0 && (
            <div className="hidden -space-x-2 sm:flex">
              {members.slice(0, 5).map((m) => (
                <span
                  key={m.userId}
                  title={m.shortName}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-900 bg-gradient-to-br from-sky-500 to-indigo-500 text-[10px] font-semibold text-white"
                >
                  {m.initials}
                </span>
              ))}
            </div>
          )}
          {isOwner && !isPersonal && (
            <Button size="sm" variant="secondary" onClick={() => setMembersOpen(true)}>
              <UsersIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Участники</span>
            </Button>
          )}
          {isOwner && (
            <>
              <Button
                size="sm"
                variant="ghost"
                title="Переименовать доску"
                onClick={() => {
                  const next = prompt("Название доски", title);
                  if (next && next.trim()) start(() => updateBoard(boardId, next, color));
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                title="Удалить доску"
                onClick={() => {
                  if (confirm("Удалить доску со всеми задачами?")) {
                    start(() => deleteBoard(boardId));
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Columns */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-4 sm:p-6">
        {columns.map((col) => (
          <ColumnView
            key={col.id}
            column={col}
            canEdit={canEdit}
            onOpenTask={setSelectedTaskId}
            formatDue={formatDue}
          />
        ))}
        {canEdit && <AddColumn boardId={boardId} />}
      </div>

      <TaskModal
        task={selectedTask}
        members={members}
        canEdit={canEdit}
        onClose={() => setSelectedTaskId(null)}
      />
      <MembersModal
        open={membersOpen}
        boardId={boardId}
        members={members}
        directory={directory}
        onClose={() => setMembersOpen(false)}
      />
    </div>
  );
}

function ColumnView({
  column,
  canEdit,
  onOpenTask,
  formatDue,
}: {
  column: BoardColumn;
  canEdit: boolean;
  onOpenTask: (id: string) => void;
  formatDue: (s: string) => string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [, start] = useTransition();

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-neutral-800 bg-neutral-900/30">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-neutral-200">
            {column.title}
          </h3>
          <span className="rounded-full bg-neutral-800 px-1.5 text-xs text-neutral-400">
            {column.tasks.length}
          </span>
        </div>
        {canEdit && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl"
                  >
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        const next = prompt("Название колонки", column.title);
                        if (next && next.trim())
                          start(() => renameColumn(column.id, next));
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Переименовать
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        if (confirm("Удалить колонку и её задачи?"))
                          start(() => deleteColumn(column.id));
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-300 hover:bg-neutral-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Удалить
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        <AnimatePresence initial={false}>
          {column.tasks.map((task) => (
            <motion.button
              key={task.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onClick={() => onOpenTask(task.id)}
              className="block w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800/60 text-left transition hover:border-neutral-600 hover:bg-neutral-800"
            >
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
                {(task.dueDate || task.assignees.length > 0) && (
                  <div className="mt-2 flex items-center justify-between">
                    {task.dueDate ? (
                      <span
                        className={cn(
                          "flex items-center gap-1 text-[11px]",
                          isOverdue(task.dueDate)
                            ? "text-red-400"
                            : "text-neutral-500",
                        )}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {formatDue(task.dueDate)}
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
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {canEdit && <AddTask columnId={column.id} />}
    </div>
  );
}

function AddTask({ columnId }: { columnId: string }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [, start] = useTransition();

  function submit() {
    const title = value.trim();
    if (title) start(() => createTask(columnId, title));
    setValue("");
    setAdding(false);
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="m-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
      >
        <Plus className="h-4 w-4" /> Добавить задачу
      </button>
    );
  }
  return (
    <div className="p-2">
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") setAdding(false);
        }}
        onBlur={submit}
        rows={2}
        placeholder="Название задачи…"
        className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-2 text-sm text-neutral-100 outline-none focus:border-sky-500"
      />
    </div>
  );
}

function AddColumn({ boardId }: { boardId: string }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [, start] = useTransition();

  function submit() {
    const title = value.trim();
    if (title) start(() => createColumn(boardId, title));
    setValue("");
    setAdding(false);
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex h-min w-72 shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-neutral-800 px-3 py-2.5 text-sm text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300"
      >
        <Plus className="h-4 w-4" /> Добавить колонку
      </button>
    );
  }
  return (
    <div className="w-72 shrink-0">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setAdding(false);
        }}
        onBlur={submit}
        placeholder="Название колонки…"
        className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-sky-500"
      />
    </div>
  );
}
