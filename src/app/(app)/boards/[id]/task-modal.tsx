"use client";

import React, { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trash2,
  Check,
  UserCircle2,
  CalendarRange,
  Flag,
  Share2,
  ArrowRight,
  ArrowLeft,
  Lock,
  Palette,
  Users as UsersIcon,
  X,
  Repeat,
  CheckCheck,
  ListTodo,
  Clock,
  History,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { PRIORITIES, PRIORITY_META, normalizePriority } from "@/lib/priority";
import {
  WEEKDAY_LABELS,
  parseRecurDays,
  type RecurFreq,
} from "@/lib/recurrence";
import {
  updateTask,
  deleteTask,
  toggleAssignee,
  toggleAssigneeConfirm,
  completeRecurring,
  createSubtask,
  toggleSubtaskDone,
  deleteSubtask,
  logTime,
  deleteTimeEntry,
} from "../actions";
import { useConfirm } from "@/components/ui/dialog-provider";
import { CommentsSection } from "./comments-section";
import type { BoardTask, BoardMemberView, DirectoryUser } from "./board-view";

const TASK_COLORS = ["#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#ef4444"];

const LINK_LABEL: Record<string, string> = {
  RELATES: "связь",
  BLOCKS: "блокирует",
  DEPENDS: "зависит",
};

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </p>
  );
}

export function TaskModal({
  task,
  members,
  directory = [],
  canEdit,
  boardCanEdit,
  currentUserId,
  canModerate,
  canDelete,
  onClose,
}: {
  task: BoardTask | null;
  members: BoardMemberView[];
  directory?: DirectoryUser[];
  canEdit: boolean;
  boardCanEdit: boolean;
  currentUserId: string;
  canModerate: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok?: boolean; error?: string }, fd: FormData) => {
      if (!task) return {};
      return await updateTask(task.id, fd);
    },
    {},
  );
  const [assignPending, startAssign] = useTransition();
  const [delPending, startDel] = useTransition();
  const [completePending, startComplete] = useTransition();
  const [confirmPending, startConfirm] = useTransition();
  const confirm = useConfirm();
  const openedAt = useRef(0);

  // Detail data (subtasks, history, time entries) loaded lazily
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeItem[]>([]);
  const [detailLoaded, setDetailLoaded] = useState(false);

  useEffect(() => {
    if (!task) { setDetailLoaded(false); return; }
    setDetailLoaded(false);
    fetch(`/api/tasks/${task.id}/detail`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setSubtasks(d.subtasks ?? []);
        setHistory(d.history ?? []);
        setTimeEntries(d.timeEntries ?? []);
        setDetailLoaded(true);
      })
      .catch(() => setDetailLoaded(true));
  }, [task?.id]);

  useEffect(() => {
    if (task) openedAt.current = Date.now();
  }, [task]);

  // Ignore a backdrop "click" that arrives right after opening (ghost click
  // / the same press that opened the card) — это и закрывало модалку сразу.
  const guardedClose = () => {
    if (Date.now() - openedAt.current > 350) onClose();
  };

  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (task) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [task, onClose]);

  const pr = task ? PRIORITY_META[normalizePriority(task.priority)] : null;

  return (
    <AnimatePresence>
      {task && pr && (
        <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={guardedClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="glass-strong relative z-10 flex h-dvh w-full flex-col overflow-hidden shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-4xl sm:rounded-2xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-4 py-3 sm:px-6">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
                  pr.badge,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", pr.dot)} />
                {pr.label}
              </span>
              {task.isPersonal && (
                <span className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                  <Lock className="h-3 w-3" />
                  личная
                </span>
              )}
              <span className="ml-auto hidden items-center gap-1.5 text-xs text-neutral-500 sm:flex">
                <UserCircle2 className="h-4 w-4" />
                {task.createdByName}
              </span>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <form action={formAction} className="flex flex-col gap-5 p-4 sm:p-6">
                <input
                  name="title"
                  defaultValue={task.title}
                  disabled={!canEdit}
                  placeholder="Название задачи"
                  className="w-full rounded-lg border border-transparent bg-transparent text-xl font-bold text-neutral-100 outline-none transition placeholder:text-neutral-600 hover:border-neutral-800 focus:border-sky-500 focus:bg-neutral-900/60 focus:px-3 focus:py-1.5 disabled:opacity-70 sm:text-2xl"
                />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                  {/* Main column: description */}
                  <div className="min-w-0 space-y-2">
                    <SectionTitle icon={UserCircle2}>Описание</SectionTitle>
                    <textarea
                      name="description"
                      defaultValue={task.description ?? ""}
                      disabled={!canEdit}
                      rows={8}
                      className="w-full resize-y rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3 text-base sm:text-sm leading-relaxed text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:opacity-60"
                      placeholder="Опишите задачу, шаги, критерии готовности…"
                    />
                  </div>

                  {/* Sidebar: properties */}
                  <aside className="space-y-5 lg:rounded-xl lg:border lg:border-neutral-800 lg:bg-neutral-950/30 lg:p-4">
                    <div>
                      <SectionTitle icon={Flag}>Срочность</SectionTitle>
                      <PrioritySelector
                        key={task.id}
                        initial={task.priority}
                        disabled={!canEdit}
                      />
                    </div>

                    <div>
                      <SectionTitle icon={CalendarRange}>Сроки</SectionTitle>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="mb-1 block text-[11px] text-neutral-500">
                            Начало
                          </span>
                          <input
                            type="date"
                            name="startDate"
                            defaultValue={task.startDate ?? ""}
                            disabled={!canEdit}
                            className="h-9 w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-2 text-xs text-neutral-100 [color-scheme:dark] outline-none focus:border-sky-500"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] text-neutral-500">
                            Срок
                          </span>
                          <input
                            type="date"
                            name="dueDate"
                            defaultValue={task.dueDate ?? ""}
                            disabled={!canEdit}
                            className="h-9 w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-2 text-xs text-neutral-100 [color-scheme:dark] outline-none focus:border-sky-500"
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <SectionTitle icon={UsersIcon}>Исполнители</SectionTitle>
                      {members.length === 0 ? (
                        <p className="text-xs text-neutral-500">
                          Нет участников.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {members.map((m) => {
                            const active = task.assigneeIds.includes(m.userId);
                            return (
                              <button
                                key={m.userId}
                                type="button"
                                disabled={!canEdit || assignPending}
                                onClick={() =>
                                  startAssign(() =>
                                    toggleAssignee(task.id, m.userId),
                                  )
                                }
                                className={cn(
                                  "flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition",
                                  active
                                    ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
                                    : "border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800",
                                )}
                              >
                                <Avatar
                                  image={m.avatar}
                                  emoji={m.emoji}
                                  initials={m.initials}
                                  size={20}
                                />
                                {m.shortName}
                                {active && <Check className="h-3 w-3" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {task.assignees.length > 0 && (
                      <div>
                        <SectionTitle icon={CheckCheck}>
                          Выполнение (
                          {task.assignees.filter((a) => a.confirmed).length}/
                          {task.assignees.length})
                        </SectionTitle>
                        <div className="space-y-1">
                          {task.assignees.map((a) => (
                            <div
                              key={a.userId}
                              className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 text-xs"
                            >
                              <Avatar
                                image={a.avatar}
                                emoji={a.emoji}
                                initials={a.initials}
                                size={20}
                              />
                              <span className="min-w-0 flex-1 truncate text-neutral-200">
                                {a.shortName}
                              </span>
                              {a.confirmed ? (
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <Check className="h-3.5 w-3.5" />
                                  готово
                                </span>
                              ) : (
                                <span className="text-neutral-500">ожидает</span>
                              )}
                            </div>
                          ))}
                        </div>
                        {task.assignees.some((a) => a.userId === currentUserId) && (
                          <Button
                            type="button"
                            variant={
                              task.assignees.find((a) => a.userId === currentUserId)
                                ?.confirmed
                                ? "ghost"
                                : "secondary"
                            }
                            size="sm"
                            loading={confirmPending}
                            onClick={() =>
                              startConfirm(() => toggleAssigneeConfirm(task.id))
                            }
                            className="mt-2 w-full"
                          >
                            <CheckCheck className="h-4 w-4" />
                            {task.assignees.find((a) => a.userId === currentUserId)
                              ?.confirmed
                              ? "Отменить подтверждение"
                              : "Подтвердить выполнение"}
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Subtasks */}
                    <SubtasksSection
                      subtasks={subtasks}
                      canEdit={canEdit}
                      loaded={detailLoaded}
                      onAdd={async (title) => {
                        const id = await createSubtask(task.id, title);
                        if (id) setSubtasks((s) => [...s, { id, title, done: false }]);
                      }}
                      onToggle={async (subtaskId) => {
                        await toggleSubtaskDone(subtaskId);
                        setSubtasks((s) =>
                          s.map((x) => x.id === subtaskId ? { ...x, done: !x.done } : x),
                        );
                      }}
                      onDelete={async (subtaskId) => {
                        await deleteSubtask(subtaskId);
                        setSubtasks((s) => s.filter((x) => x.id !== subtaskId));
                      }}
                    />

                    {/* Time tracking */}
                    <TimeTrackingSection
                      taskId={task.id}
                      entries={timeEntries}
                      loaded={detailLoaded}
                      onLogged={(entry) => setTimeEntries((es) => [entry, ...es])}
                      onDelete={async (id) => {
                        await deleteTimeEntry(id);
                        setTimeEntries((es) => es.filter((e) => e.id !== id));
                      }}
                    />

                    <div>
                      <SectionTitle icon={Palette}>Цвет</SectionTitle>
                      <input
                        type="hidden"
                        name="color"
                        defaultValue={task.color ?? ""}
                        id="t-color-input"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <ColorSwatches initial={task.color} disabled={!canEdit} />
                      </div>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900/40 p-2.5">
                      <input
                        type="checkbox"
                        name="isPersonal"
                        defaultChecked={task.isPersonal}
                        disabled={!canEdit}
                        className="h-4 w-4 accent-sky-500"
                      />
                      <span className="flex items-center gap-1.5 text-xs text-neutral-300">
                        <Lock className="h-3.5 w-3.5 text-neutral-500" />
                        Личная задача
                      </span>
                    </label>

                    <div>
                      <SectionTitle icon={Repeat}>Повторение</SectionTitle>
                      <RecurrenceEditor
                        key={task.id}
                        task={task}
                        disabled={!canEdit}
                      />
                    </div>

                    {task.recurFreq && boardCanEdit && (
                      <Button
                        type="button"
                        variant="secondary"
                        loading={completePending}
                        onClick={() =>
                          startComplete(() => completeRecurring(task.id))
                        }
                        className="w-full"
                      >
                        <CheckCheck className="h-4 w-4" />
                        Выполнить — следующая дата
                      </Button>
                    )}

                    {task.links.length > 0 && (
                      <div>
                        <SectionTitle icon={Share2}>Связи</SectionTitle>
                        <div className="space-y-1.5">
                          {task.links.map((l, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 px-2.5 py-1.5 text-xs"
                            >
                              {l.direction === "out" ? (
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                              ) : (
                                <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                              )}
                              <span className="min-w-0 flex-1 truncate text-neutral-200">
                                {l.otherTitle}
                              </span>
                              <span className="shrink-0 text-neutral-500">
                                {LINK_LABEL[l.type] ?? "связь"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </aside>
                </div>

                {state.error && (
                  <p className="text-sm text-red-300">{state.error}</p>
                )}

                {(canEdit || canDelete) && (
                  <div className="flex items-center justify-between border-t border-neutral-800 pt-4">
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        loading={delPending}
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Удалить задачу?",
                            message: `«${task.title}» будет удалена.`,
                            confirmLabel: "Удалить",
                            danger: true,
                          });
                          if (ok) {
                            startDel(async () => {
                              await deleteTask(task.id);
                              onClose();
                            });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Удалить
                      </Button>
                    ) : (
                      <span />
                    )}
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={onClose}>
                          Отмена
                        </Button>
                        <Button type="submit" loading={pending}>
                          Сохранить
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </form>

              {/* Comments — full width, comfortable */}
              <div className="border-t border-neutral-800 px-4 pb-5 pt-4 sm:px-6">
                <CommentsSection
                  taskId={task.id}
                  comments={task.comments}
                  currentUserId={currentUserId}
                  canModerate={canModerate}
                  mentionUsers={directory}
                />
              </div>

              {/* Task history */}
              {history.length > 0 && (
                <div className="border-t border-neutral-800 px-4 pb-5 pt-4 sm:px-6">
                  <HistorySection history={history} />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ── Subtasks section ───────────────────────────────────────────────────────

type SubtaskItem = { id: string; title: string; done: boolean };

function SubtasksSection({
  subtasks,
  canEdit,
  loaded,
  onAdd,
  onToggle,
  onDelete,
}: {
  subtasks: SubtaskItem[];
  canEdit: boolean;
  loaded: boolean;
  onAdd: (title: string) => Promise<unknown>;
  onToggle: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [pending, start] = useTransition();
  const done = subtasks.filter((s) => s.done).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <ListTodo className="h-3.5 w-3.5" />
          Подзадачи
          {subtasks.length > 0 && (
            <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-neutral-400">
              {done}/{subtasks.length}
            </span>
          )}
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowInput((v) => !v)}
            className="rounded p-0.5 text-neutral-600 hover:text-neutral-300"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(done / subtasks.length) * 100}%` }}
          />
        </div>
      )}

      {!loaded && <p className="text-xs text-neutral-600">Загрузка…</p>}

      <div className="space-y-1">
        {subtasks.map((s) => (
          <div key={s.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/[0.03]">
            <button
              type="button"
              onClick={() => start(() => onToggle(s.id))}
              disabled={pending}
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                s.done
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                  : "border-neutral-600 hover:border-neutral-400",
              )}
            >
              {s.done && <Check className="h-2.5 w-2.5" />}
            </button>
            <span className={cn("flex-1 text-xs", s.done ? "text-neutral-500 line-through" : "text-neutral-200")}>
              {s.title}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => start(() => onDelete(s.id))}
                className="hidden rounded p-0.5 text-neutral-700 hover:text-red-400 group-hover:block"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {showInput && canEdit && (
        <form
          className="mt-1.5 flex gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            const t = newTitle.trim();
            if (!t) return;
            setAdding(true);
            await onAdd(t);
            setNewTitle("");
            setAdding(false);
          }}
        >
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setShowInput(false)}
            placeholder="Подзадача…"
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900/60 px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || adding}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}

// ── Time tracking section ─────────────────────────────────────────────────

type TimeItem = { id: string; minutes: number; note: string | null; loggedAt: string; userName: string; isMe: boolean };

function TimeTrackingSection({
  taskId,
  entries,
  loaded,
  onLogged,
  onDelete,
}: {
  taskId: string;
  entries: TimeItem[];
  loaded: boolean;
  onLogged: (entry: TimeItem) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [delPending, startDel] = useTransition();

  const totalMins = entries.reduce((s, e) => s + e.minutes, 0);
  const totalLabel = totalMins >= 60
    ? `${Math.floor(totalMins / 60)}ч ${totalMins % 60}м`
    : `${totalMins}м`;

  function fmtMins(m: number) {
    return m >= 60 ? `${Math.floor(m / 60)}ч ${m % 60}м` : `${m}м`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const mins = parseInt(minutes, 10);
    if (!mins || mins < 1) { setErr("Введите минуты"); return; }
    setSubmitting(true);
    const res = await logTime(taskId, mins, note);
    setSubmitting(false);
    if (res?.error) { setErr(res.error); return; }
    onLogged({
      id: crypto.randomUUID(),
      minutes: mins,
      note: note.trim() || null,
      loggedAt: new Date().toISOString(),
      userName: "Вы",
      isMe: true,
    });
    setMinutes("");
    setNote("");
    setShowForm(false);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Clock className="h-3.5 w-3.5" />
          Время
          {totalMins > 0 && (
            <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-sky-400">
              {totalLabel}
            </span>
          )}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded p-0.5 text-neutral-600 hover:text-neutral-300"
            title="Записать время"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded p-0.5 text-neutral-600 hover:text-neutral-300"
            >
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {!loaded && <p className="text-xs text-neutral-600">Загрузка…</p>}

      {showForm && (
        <form onSubmit={submit} className="mb-2 space-y-1.5">
          <div className="flex gap-1.5">
            <input
              autoFocus
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="мин."
              className="h-8 w-20 rounded-lg border border-neutral-700 bg-neutral-900/60 px-2 text-xs text-neutral-100 outline-none focus:border-sky-500"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Заметка (необязательно)"
              className="h-8 flex-1 rounded-lg border border-neutral-700 bg-neutral-900/60 px-2 text-xs text-neutral-100 outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={submitting}
              className="h-8 rounded-lg border border-neutral-700 bg-neutral-800 px-2 text-xs text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </form>
      )}

      {open && entries.length > 0 && (
        <div className="space-y-1">
          {entries.map((e) => (
            <div key={e.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/[0.03]">
              <Clock className="h-3 w-3 shrink-0 text-sky-400/60" />
              <span className="font-medium text-sky-300 text-xs">{fmtMins(e.minutes)}</span>
              {e.note && <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-500">{e.note}</span>}
              {!e.note && <span className="flex-1" />}
              <span className="shrink-0 text-[10px] text-neutral-600">{e.userName}</span>
              {e.isMe && (
                <button
                  type="button"
                  disabled={delPending}
                  onClick={() => startDel(() => onDelete(e.id))}
                  className="hidden rounded p-0.5 text-neutral-700 hover:text-red-400 group-hover:block"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Task history section ──────────────────────────────────────────────────

type HistoryItem = { id: string; action: string; meta: Record<string, unknown> | null; createdAt: string; userName: string; isMe: boolean };

const ACTION_LABELS: Record<string, string> = {
  created: "создал задачу",
  title: "изменил название",
  description: "изменил описание",
  column: "перенёс задачу",
  priority: "изменил приоритет",
  assignee_add: "добавил исполнителя",
  assignee_remove: "снял исполнителя",
  due: "изменил срок",
  start: "изменил начало",
  label_add: "добавил метку",
  label_remove: "убрал метку",
  completed: "завершил задачу",
  subtask_add: "добавил подзадачу",
  time_logged: "записал время",
  attachment_add: "прикрепил файл",
};

function HistorySection({ history }: { history: HistoryItem[] }) {
  const [collapsed, setCollapsed] = useState(true);
  const shown = collapsed ? history.slice(0, 5) : history;

  function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "только что";
    if (mins < 60) return `${mins} мин`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ч`;
    return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  }

  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-neutral-300">
        <History className="h-4 w-4 text-neutral-500" />
        История
        <span className="rounded-full bg-white/10 px-1.5 text-xs text-neutral-400">
          {history.length}
        </span>
      </p>
      <div className="space-y-2">
        {shown.map((h) => (
          <div key={h.id} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-600" />
            <span className={cn("shrink-0 font-medium", h.isMe ? "text-sky-300" : "text-neutral-300")}>
              {h.userName}
            </span>
            <span className="text-neutral-500">
              {ACTION_LABELS[h.action] ?? h.action}
              {h.meta?.after != null && ` «${String(h.meta.after).slice(0, 40)}»`}
              {h.action === "time_logged" && h.meta?.minutes != null && ` ${String(h.meta.minutes)} мин`}
            </span>
            <span className="ml-auto shrink-0 text-[10px] text-neutral-600">
              {formatRelative(h.createdAt)}
            </span>
          </div>
        ))}
      </div>
      {history.length > 5 && (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mt-2 text-xs text-neutral-500 hover:text-neutral-300"
        >
          {collapsed ? `Ещё ${history.length - 5} записей` : "Свернуть"}
        </button>
      )}
    </div>
  );
}

function parseDayList(s: string): number[] {
  return Array.from(
    new Set(
      s
        .split(/[,\s]+/)
        .map((x) => parseInt(x, 10))
        .filter((n) => n >= 1 && n <= 31),
    ),
  );
}

function RecurrenceEditor({
  task,
  disabled,
}: {
  task: BoardTask;
  disabled: boolean;
}) {
  const initFreq: "" | RecurFreq =
    task.recurFreq === "DAILY" ||
    task.recurFreq === "WEEKLY" ||
    task.recurFreq === "MONTHLY"
      ? task.recurFreq
      : "";
  const [freq, setFreq] = useState<"" | RecurFreq>(initFreq);
  const [interval, setIntervalN] = useState(task.recurInterval || 1);
  const [days, setDays] = useState<number[]>(parseRecurDays(task.recurDays));
  const [until, setUntil] = useState(task.recurUntil ?? "");

  const recurDaysValue =
    freq === "WEEKLY" || freq === "MONTHLY" ? JSON.stringify(days) : "";

  const freqs: [string, string][] = [
    ["", "Нет"],
    ["DAILY", "День"],
    ["WEEKLY", "Неделя"],
    ["MONTHLY", "Месяц"],
  ];

  return (
    <div className="space-y-2.5">
      <input type="hidden" name="recurFreq" value={freq} />
      <input type="hidden" name="recurInterval" value={interval} />
      <input type="hidden" name="recurDays" value={recurDaysValue} />
      <input type="hidden" name="recurUntil" value={until} />

      <div className="grid grid-cols-4 gap-1.5">
        {freqs.map(([val, label]) => (
          <button
            key={val}
            type="button"
            disabled={disabled}
            onClick={() => {
              setFreq(val as "" | RecurFreq);
              if (val !== "WEEKLY" && val !== "MONTHLY") setDays([]);
            }}
            className={cn(
              "rounded-lg border px-1 py-1.5 text-xs transition disabled:opacity-50",
              freq === val
                ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                : "border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:bg-neutral-800/60",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {freq === "DAILY" && (
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          каждые
          <input
            type="number"
            min={1}
            max={365}
            value={interval}
            disabled={disabled}
            onChange={(e) => setIntervalN(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="h-8 w-16 rounded-lg border border-neutral-700 bg-neutral-900/60 px-2 text-center text-neutral-100 outline-none focus:border-sky-500"
          />
          дн.
        </label>
      )}

      {freq === "WEEKLY" && (
        <div className="flex flex-wrap gap-1">
          {WEEKDAY_LABELS.map((lbl, i) => {
            const n = i + 1;
            const active = days.includes(n);
            return (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() =>
                  setDays((ds) =>
                    ds.includes(n) ? ds.filter((x) => x !== n) : [...ds, n],
                  )
                }
                className={cn(
                  "h-7 w-9 rounded-md border text-xs transition disabled:opacity-50",
                  active
                    ? "border-violet-500/50 bg-violet-500/20 text-violet-200"
                    : "border-neutral-700 text-neutral-400 hover:bg-neutral-800/60",
                )}
              >
                {lbl}
              </button>
            );
          })}
        </div>
      )}

      {freq === "MONTHLY" && (
        <input
          type="text"
          disabled={disabled}
          defaultValue={days.join(", ")}
          onChange={(e) => setDays(parseDayList(e.target.value))}
          placeholder="числа месяца, напр. 1, 15"
          className="h-8 w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-2 text-xs text-neutral-100 outline-none focus:border-sky-500"
        />
      )}

      {freq && (
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          до
          <input
            type="date"
            value={until}
            disabled={disabled}
            onChange={(e) => setUntil(e.target.value)}
            className="h-8 flex-1 rounded-lg border border-neutral-700 bg-neutral-900/60 px-2 text-xs text-neutral-100 [color-scheme:dark] outline-none focus:border-sky-500"
          />
        </label>
      )}
    </div>
  );
}

function PrioritySelector({
  initial,
  disabled,
}: {
  initial: string;
  disabled: boolean;
}) {
  const [value, setValue] = useState(normalizePriority(initial));
  return (
    <>
      <input type="hidden" name="priority" value={value} />
      <div className="grid grid-cols-3 gap-1.5">
        {PRIORITIES.map((p) => {
          const meta = PRIORITY_META[p];
          const active = value === p;
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => setValue(p)}
              className={cn(
                "flex items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-xs transition disabled:opacity-50",
                active
                  ? "border-transparent " + meta.badge
                  : "border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:bg-neutral-800/60",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
              {meta.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

function ColorSwatches({
  initial,
  disabled,
}: {
  initial: string | null;
  disabled: boolean;
}) {
  function set(c: string) {
    const input = document.getElementById("t-color-input") as HTMLInputElement | null;
    if (input) input.value = c;
    document
      .querySelectorAll<HTMLButtonElement>("[data-color-swatch]")
      .forEach((el) => el.setAttribute("data-active", String(el.dataset.value === c)));
  }
  return (
    <>
      <button
        type="button"
        data-color-swatch
        data-value=""
        data-active={!initial}
        disabled={disabled}
        onClick={() => set("")}
        className="h-7 w-7 rounded-full border border-neutral-700 bg-neutral-800 text-xs text-neutral-500 data-[active=true]:ring-2 data-[active=true]:ring-white data-[active=true]:ring-offset-2 data-[active=true]:ring-offset-neutral-900"
        title="Без цвета"
      >
        ∅
      </button>
      {TASK_COLORS.map((c) => (
        <motion.button
          key={c}
          type="button"
          whileTap={{ scale: 0.9 }}
          data-color-swatch
          data-value={c}
          data-active={initial === c}
          disabled={disabled}
          onClick={() => set(c)}
          style={{ backgroundColor: c }}
          className="h-7 w-7 rounded-full transition data-[active=true]:ring-2 data-[active=true]:ring-white data-[active=true]:ring-offset-2 data-[active=true]:ring-offset-neutral-900"
        />
      ))}
    </>
  );
}
