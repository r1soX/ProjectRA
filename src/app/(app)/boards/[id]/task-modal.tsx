"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PRIORITIES, PRIORITY_META, normalizePriority } from "@/lib/priority";
import { updateTask, deleteTask, toggleAssignee } from "../actions";
import { useConfirm } from "@/components/ui/dialog-provider";
import { CommentsSection } from "./comments-section";
import type { BoardTask, BoardMemberView } from "./board-view";

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
  canEdit,
  currentUserId,
  canModerate,
  canDelete,
  onClose,
}: {
  task: BoardTask | null;
  members: BoardMemberView[];
  canEdit: boolean;
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
  const confirm = useConfirm();

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
            onClick={onClose}
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
                      className="w-full resize-y rounded-xl border border-neutral-800 bg-neutral-950/40 px-3.5 py-3 text-sm leading-relaxed text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:opacity-60"
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
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-[9px] font-semibold text-white">
                                  {m.initials}
                                </span>
                                {m.shortName}
                                {active && <Check className="h-3 w-3" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

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
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
