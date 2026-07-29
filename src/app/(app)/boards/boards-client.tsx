"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Plus,
  Lock,
  Users as UsersIcon,
  AlertCircle,
  ListChecks,
  Archive,
  ArchiveRestore,
  ChevronDown,
  Move,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { useStatuses } from "@/components/status-provider";
import {
  createBoard,
  archiveBoard,
  unarchiveBoard,
  moveBoard,
  resetBoardLayout,
  type ActionState,
} from "./actions";

export type BoardCard = {
  id: string;
  title: string;
  color: string;
  isPersonal: boolean;
  ownerName: string;
  taskCount: number;
  statusCounts: Record<string, number>;
  canArchive: boolean;
  x: number | null;
  y: number | null;
};

const CARD_W = 288; // fixed card width for free-canvas placement
const GAP = 16;
const DEFAULT_ROW_H = 210;

/** True on ≥ md screens. The free canvas is desktop-only; mobile uses a grid. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

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

/** The card visual — shared by the desktop canvas tile and the mobile grid. */
function BoardCardInner({
  board,
  showMove,
}: {
  board: BoardCard;
  showMove: boolean;
}) {
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
    <div className="glass glass-hover group relative block overflow-hidden rounded-2xl shadow-lg shadow-black/20 transition hover:shadow-xl hover:shadow-sky-500/10">
      <div className="h-1.5" style={{ backgroundColor: board.color }} />
      {showMove && (
        <span
          className="absolute left-1.5 top-2.5 z-10 text-neutral-600"
          title="Перетащите карточку"
        >
          <Move className="h-3.5 w-3.5" />
        </span>
      )}
      {board.canArchive && (
        <button
          onClick={onArchive}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={pending}
          title="Архивировать доску"
          aria-label="Архивировать доску"
          className="absolute right-2 top-3 z-10 rounded-lg p-1.5 text-neutral-500 opacity-60 transition hover:bg-white/10 hover:text-neutral-200 focus:opacity-100 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Archive className="h-4 w-4" />
        </button>
      )}
      <div className="p-5">
        <div className={cn("flex items-start justify-between gap-2", showMove && "pl-5")}>
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
        <div className="mt-4 space-y-2.5 text-xs text-neutral-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5" />
              {board.taskCount} задач
            </span>
            <span>·</span>
            <span className="truncate">{board.ownerName}</span>
          </div>
          <StatusBreakdown counts={board.statusCounts} total={board.taskCount} />
        </div>
      </div>
    </div>
  );
}

/** Desktop: a freely draggable, absolutely-positioned card on the canvas. */
function BoardTile({
  board,
  pos,
}: {
  board: BoardCard;
  pos: { x: number; y: number };
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: board.id });

  const style: React.CSSProperties = {
    position: "absolute",
    left: pos.x,
    top: pos.y,
    width: CARD_W,
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    zIndex: isDragging ? 30 : undefined,
    touchAction: isDragging ? "none" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      // dnd-kit swallows the click that follows a real drag (same element as
      // the drag listeners), so a plain click opens the board but a drag won't.
      onClick={() => router.push(`/boards/${board.id}`)}
      className={cn(
        "cursor-grab select-none active:cursor-grabbing",
        isDragging && "opacity-80",
      )}
    >
      <BoardCardInner board={board} showMove />
    </div>
  );
}

function StatusBreakdown({
  counts,
  total,
}: {
  counts: Record<string, number>;
  total: number;
}) {
  const statuses = useStatuses();
  if (total === 0) {
    return <p className="text-neutral-600">Задач пока нет</p>;
  }
  const present = statuses.filter((s) => (counts[s.key] ?? 0) > 0);
  return (
    <div className="space-y-1.5">
      {/* Proportional status bar */}
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        {present.map((s) => (
          <div
            key={s.key}
            style={{
              width: `${((counts[s.key] ?? 0) / total) * 100}%`,
              backgroundColor: s.color,
            }}
            title={`${s.label}: ${counts[s.key]}`}
          />
        ))}
      </div>
      {/* Per-status counts */}
      <div className="flex flex-wrap gap-x-2.5 gap-y-1">
        {present.map((s) => (
          <span key={s.key} className="flex items-center gap-1 text-neutral-400">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="font-medium text-neutral-300">{counts[s.key]}</span>
            {s.label}
          </span>
        ))}
      </div>
    </div>
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
  const isDesktop = useIsDesktop();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});

  // Measure the canvas width (drives the default layout + horizontal clamping).
  // Re-runs when the canvas mounts (isDesktop flips) so width is captured.
  useEffect(() => {
    const measure = () => setWidth(canvasRef.current?.clientWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isDesktop]);

  // Seed positions: saved x/y from the server, a grid default for the rest.
  useEffect(() => {
    if (!width) return;
    const perRow = Math.max(1, Math.floor((width + GAP) / (CARD_W + GAP)));
    setPos((prev) => {
      const next = { ...prev };
      boards.forEach((b, i) => {
        if (next[b.id]) return;
        if (b.x != null && b.y != null) {
          next[b.id] = { x: b.x, y: b.y };
        } else {
          const col = i % perRow;
          const row = Math.floor(i / perRow);
          next[b.id] = {
            x: col * (CARD_W + GAP),
            y: row * (DEFAULT_ROW_H + GAP),
          };
        }
      });
      for (const id of Object.keys(next)) {
        if (!boards.some((b) => b.id === id)) delete next[id];
      }
      return next;
    });
  }, [width, boards]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const maxX = Math.max(0, width - CARD_W);
    setPos((prev) => {
      const cur = prev[id] ?? { x: 0, y: 0 };
      const nx = Math.min(Math.max(0, cur.x + e.delta.x), maxX);
      const ny = Math.max(0, cur.y + e.delta.y);
      moveBoard(id, nx, ny);
      return { ...prev, [id]: { x: nx, y: ny } };
    });
  }

  function onReset() {
    const perRow = Math.max(1, Math.floor((width + GAP) / (CARD_W + GAP)));
    const next: Record<string, { x: number; y: number }> = {};
    boards.forEach((b, i) => {
      next[b.id] = {
        x: (i % perRow) * (CARD_W + GAP),
        y: Math.floor(i / perRow) * (DEFAULT_ROW_H + GAP),
      };
    });
    setPos(next);
    resetBoardLayout();
  }

  // At least a screenful tall, growing to fit the lowest card.
  const contentBottom =
    Math.max(0, ...boards.map((b) => pos[b.id]?.y ?? 0)) + DEFAULT_ROW_H + 40;
  const canvasHeight = Math.max(576, contentBottom);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Доски</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {boards.length === 0
              ? "Пока нет досок"
              : isDesktop && boards.length > 1
                ? `Всего: ${boards.length} · перетащите карточки, чтобы расставить как удобно`
                : `Всего: ${boards.length}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDesktop && boards.length > 1 && (
            <button
              onClick={onReset}
              title="Сбросить раскладку"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-400 transition hover:bg-white/10 hover:text-neutral-200"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Сбросить раскладку</span>
            </button>
          )}
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Новая доска</span>
            </Button>
          )}
        </div>
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
      ) : isDesktop ? (
        // Desktop: free-form draggable canvas.
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div
            ref={canvasRef}
            className="relative w-full"
            style={{ height: canvasHeight }}
          >
            {boards.map((b) => {
              const p = pos[b.id];
              if (!p) return null;
              return <BoardTile key={b.id} board={b} pos={p} />;
            })}
          </div>
        </DndContext>
      ) : (
        // Mobile: plain responsive grid, no dragging (avoids the tall canvas).
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {boards.map((b) => (
            <Link key={b.id} href={`/boards/${b.id}`}>
              <BoardCardInner board={b} showMove={false} />
            </Link>
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
