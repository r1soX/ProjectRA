"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Lock, Users as UsersIcon, AlertCircle, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { createBoard, type ActionState } from "./actions";

export type BoardCard = {
  id: string;
  title: string;
  color: string;
  isPersonal: boolean;
  ownerName: string;
  taskCount: number;
};

export const BOARD_COLORS = [
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#64748b",
];

function CreateBoardModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [color, setColor] = useState(BOARD_COLORS[0]);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createBoard,
    {},
  );

  useEffect(() => {
    if (state.ok && state.message) {
      onClose();
      router.push(`/boards/${state.message}`);
    }
  }, [state, onClose, router]);

  return (
    <Modal open={open} onClose={onClose} title="Новая доска">
      <form action={action} className="space-y-4">
        <Field label="Название" htmlFor="board-title">
          <Input id="board-title" name="title" placeholder="Например, Запуск продукта" autoFocus />
        </Field>

        <Field label="Цвет">
          <input type="hidden" name="color" value={color} />
          <div className="flex flex-wrap gap-2">
            {BOARD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={cn(
                  "h-8 w-8 rounded-full transition",
                  color === c
                    ? "ring-2 ring-white ring-offset-2 ring-offset-neutral-900"
                    : "opacity-70 hover:opacity-100",
                )}
              />
            ))}
          </div>
        </Field>

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
          <input
            type="checkbox"
            name="isPersonal"
            className="h-4 w-4 accent-sky-500"
          />
          <span className="flex items-center gap-2 text-sm text-neutral-300">
            <Lock className="h-4 w-4 text-neutral-500" />
            Личная доска (видна только вам)
          </span>
        </label>

        <AnimatePresence>
          {state.error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {state.error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={pending}>
            <Plus className="h-4 w-4" />
            Создать
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function BoardsClient({ boards }: { boards: BoardCard[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Доски</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {boards.length === 0 ? "Пока нет досок" : `Всего: ${boards.length}`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Новая доска</span>
        </Button>
      </div>

      {boards.length === 0 ? (
        <button
          onClick={() => setCreateOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 py-20 text-neutral-500 transition hover:border-sky-500/40 hover:text-neutral-300"
        >
          <Plus className="h-8 w-8" />
          Создайте первую доску
        </button>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Link
                href={`/boards/${b.id}`}
                className="group block overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40 transition hover:-translate-y-0.5 hover:border-neutral-700 hover:bg-neutral-900/70"
              >
                <div className="h-1.5" style={{ backgroundColor: b.color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-neutral-100">{b.title}</h2>
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                        b.isPersonal
                          ? "bg-neutral-800 text-neutral-400"
                          : "bg-sky-500/15 text-sky-300",
                      )}
                    >
                      {b.isPersonal ? (
                        <>
                          <Lock className="h-3 w-3" /> личная
                        </>
                      ) : (
                        <>
                          <UsersIcon className="h-3 w-3" /> общая
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <ListChecks className="h-3.5 w-3.5" />
                      {b.taskCount} задач
                    </span>
                    <span>·</span>
                    <span>{b.ownerName}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <CreateBoardModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
