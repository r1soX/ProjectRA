"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Lock,
  Users as UsersIcon,
  AlertCircle,
  ListChecks,
  Archive,
  ArchiveRestore,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import {
  createBoard,
  archiveBoard,
  unarchiveBoard,
  type ActionState,
} from "./actions";

export type BoardCard = {
  id: string;
  title: string;
  color: string;
  isPersonal: boolean;
  ownerName: string;
  taskCount: number;
  canArchive: boolean;
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

export type BoardTemplateOption = { id: string; name: string };

function CreateBoardModal({
  open,
  templates,
  onClose,
}: {
  open: boolean;
  templates: BoardTemplateOption[];
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

        {templates.length > 0 && (
          <Field label="Шаблон" htmlFor="board-template">
            <select
              id="board-template"
              name="templateId"
              defaultValue=""
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900/60 px-3 py-2.5 text-base sm:text-sm text-neutral-100 outline-none focus:border-sky-500"
            >
              <option value="">Пустая доска</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}

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

function BoardTile({ board, index }: { board: BoardCard; index: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onArchive(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      await archiveBoard(board.id);
      router.refresh();
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Link
        href={`/boards/${board.id}`}
        className="glass glass-hover group relative block overflow-hidden rounded-2xl shadow-lg shadow-black/20 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/10"
      >
        <div className="h-1.5" style={{ backgroundColor: board.color }} />
        {board.canArchive && (
          <button
            onClick={onArchive}
            disabled={pending}
            title="Архивировать доску"
            aria-label="Архивировать доску"
            className="absolute right-2 top-3.5 z-10 rounded-lg p-1.5 text-neutral-500 opacity-0 transition hover:bg-white/10 hover:text-neutral-200 focus:opacity-100 group-hover:opacity-100 disabled:opacity-40"
          >
            <Archive className="h-4 w-4" />
          </button>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-semibold text-neutral-100">{board.title}</h2>
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                board.isPersonal
                  ? "bg-neutral-800 text-neutral-400"
                  : "bg-sky-500/15 text-sky-300",
                board.canArchive && "mr-7",
              )}
            >
              {board.isPersonal ? (
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
              {board.taskCount} задач
            </span>
            <span>·</span>
            <span>{board.ownerName}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function ArchivedRow({ board }: { board: BoardCard }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: board.color }} />
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-300">
        {board.title}
      </span>
      <span className="hidden text-xs text-neutral-600 sm:inline">
        {board.taskCount} задач
      </span>
      <button
        onClick={() =>
          start(async () => {
            await unarchiveBoard(board.id);
            router.refresh();
          })
        }
        disabled={pending}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-300 transition hover:bg-white/10 hover:text-neutral-100 disabled:opacity-40"
      >
        <ArchiveRestore className="h-3.5 w-3.5" />
        Восстановить
      </button>
    </div>
  );
}

export function BoardsClient({
  boards,
  archived = [],
  templates = [],
  canCreate = true,
}: {
  boards: BoardCard[];
  archived?: BoardCard[];
  templates?: BoardTemplateOption[];
  canCreate?: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Доски</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {boards.length === 0 ? "Пока нет досок" : `Всего: ${boards.length}`}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Новая доска</span>
          </Button>
        )}
      </div>

      {boards.length === 0 ? (
        canCreate ? (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 py-20 text-neutral-500 transition hover:border-sky-500/40 hover:text-neutral-300"
          >
            <Plus className="h-8 w-8" />
            Создайте первую доску
          </button>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 py-20 text-center text-neutral-500">
            Пока нет досок
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b, i) => (
            <BoardTile key={b.id} board={b} index={i} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-10">
          <button
            onClick={() => setShowArchive((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-neutral-400 transition hover:text-neutral-200"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                showArchive && "rotate-180",
              )}
            />
            <Archive className="h-4 w-4" />
            Архив · {archived.length}
          </button>
          <AnimatePresence initial={false}>
            {showArchive && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-2">
                  {archived.map((b) => (
                    <ArchivedRow key={b.id} board={b} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <CreateBoardModal
        open={createOpen}
        templates={templates}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
