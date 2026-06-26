"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { motion } from "motion/react";
import { Trash2, Check, UserCircle2, CalendarRange, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { PRIORITIES, PRIORITY_META, normalizePriority } from "@/lib/priority";
import { updateTask, deleteTask, toggleAssignee } from "../actions";
import type { BoardTask, BoardMemberView } from "./board-view";

const TASK_COLORS = ["#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#ef4444"];

export function TaskModal({
  task,
  members,
  canEdit,
  onClose,
}: {
  task: BoardTask | null;
  members: BoardMemberView[];
  canEdit: boolean;
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

  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);

  return (
    <Modal open={!!task} onClose={onClose} title="Задача">
      {task && (
        <form action={formAction} className="space-y-4">
          <Field label="Название" htmlFor="t-title">
            <Input id="t-title" name="title" defaultValue={task.title} disabled={!canEdit} autoFocus />
          </Field>

          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <UserCircle2 className="h-4 w-4 text-neutral-600" />
            Создатель:{" "}
            <span className="text-neutral-300">{task.createdByName}</span>
          </div>

          <Field label="Описание" htmlFor="t-desc">
            <textarea
              id="t-desc"
              name="description"
              defaultValue={task.description ?? ""}
              disabled={!canEdit}
              rows={3}
              className="w-full resize-y rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50"
              placeholder="Добавьте детали…"
            />
          </Field>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-neutral-300">
              <CalendarRange className="h-4 w-4 text-neutral-500" />
              Сроки
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Дата начала" htmlFor="t-start">
                <Input id="t-start" name="startDate" type="date" defaultValue={task.startDate ?? ""} disabled={!canEdit} className="[color-scheme:dark]" />
              </Field>
              <Field label="Срок завершения" htmlFor="t-due">
                <Input id="t-due" name="dueDate" type="date" defaultValue={task.dueDate ?? ""} disabled={!canEdit} className="[color-scheme:dark]" />
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-neutral-300">
              <Flag className="h-4 w-4 text-neutral-500" />
              Срочность
            </p>
            <PrioritySelector
              key={task.id}
              initial={task.priority}
              disabled={!canEdit}
            />
          </div>

          <Field label="Цвет">
            <input type="hidden" name="color" defaultValue={task.color ?? ""} id="t-color-input" />
            <div className="flex flex-wrap items-center gap-2">
              <ColorSwatches initial={task.color} disabled={!canEdit} />
            </div>
          </Field>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-300">Исполнители</p>
            {members.length === 0 ? (
              <p className="text-xs text-neutral-500">
                Нет участников. Добавьте их в настройках доски.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const active = task.assigneeIds.includes(m.userId);
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      disabled={!canEdit || assignPending}
                      onClick={() => startAssign(() => toggleAssignee(task.id, m.userId))}
                      className={cn(
                        "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition",
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

          {state.error && (
            <p className="text-sm text-red-300">{state.error}</p>
          )}

          {canEdit && (
            <div className="flex items-center justify-between border-t border-neutral-800 pt-4">
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={delPending}
                onClick={() => {
                  if (confirm("Удалить задачу?")) {
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
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Отмена
                </Button>
                <Button type="submit" loading={pending}>
                  Сохранить
                </Button>
              </div>
            </div>
          )}
        </form>
      )}
    </Modal>
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
      <div className="grid grid-cols-3 gap-2">
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
                "flex items-center justify-center gap-1.5 rounded-lg border p-2 text-sm transition disabled:opacity-50",
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
