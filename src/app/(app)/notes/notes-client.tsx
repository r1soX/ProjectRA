"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
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
  Pin,
  PinOff,
  Pencil,
  Trash2,
  StickyNote,
  Eye,
  Search,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/dialog-provider";
import { Markdown } from "@/components/ui/markdown";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { cn } from "@/lib/cn";
import {
  createNote,
  updateNote,
  deleteNote,
  toggleNotePin,
  moveNote,
  resetNoteLayout,
} from "./actions";

export type NoteView = {
  id: string;
  title: string | null;
  body: string;
  color: string | null;
  pinned: boolean;
  x: number | null;
  y: number | null;
  updatedAt: string;
};

const NOTE_COLORS = [
  "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#f59e0b", "#10b981", "#14b8a6", "#64748b",
];

const CARD_W = 264; // fixed card width for free-canvas placement
const GAP = 16;
const DEFAULT_ROW_H = 150;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rough Markdown → plain text for the card preview line. */
function stripMd(s: string) {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

export function NotesClient({
  notes,
  readOnly,
  canViewAll,
  targetUserId,
  targetName,
  users,
}: {
  notes: NoteView[];
  readOnly: boolean;
  canViewAll: boolean;
  targetUserId: string;
  targetName: string | null;
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<NoteView | null>(null);
  // null = closed; { note: null } = new; { note } = edit existing.
  const [editor, setEditor] = useState<{ note: NoteView | null } | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return notes;
    return notes.filter(
      (n) =>
        (n.title ?? "").toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q),
    );
  }, [notes, q]);

  // Free canvas only on desktop, for your own notes, with no active search.
  const canvasMode = isDesktop && !readOnly && !q;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Заметки</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {readOnly
              ? `Заметки пользователя: ${targetName ?? "—"}`
              : canvasMode && notes.length > 1
                ? "Кликните заметку, чтобы открыть · перетаскивайте, чтобы расставить"
                : "Ваши личные заметки. Поддерживается Markdown."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canViewAll && (
            <select
              value={readOnly ? targetUserId : ""}
              onChange={(e) =>
                router.push(e.target.value ? `/notes?user=${e.target.value}` : "/notes")
              }
              title="Чьи заметки смотреть"
              className="h-9 rounded-lg border border-neutral-700 bg-neutral-900/60 px-2 text-sm text-neutral-100 outline-none focus:border-sky-500"
            >
              <option value="">Мои заметки</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
          {!readOnly && (
            <Button onClick={() => setEditor({ note: null })}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Новая заметка</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search + reset layout */}
      <div className="mb-5 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию и тексту…"
            className="pl-9"
          />
        </div>
        {canvasMode && notes.length > 1 && (
          <button
            onClick={() => {
              resetNoteLayout();
              router.refresh();
            }}
            title="Сбросить раскладку"
            className="flex h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-neutral-400 transition hover:bg-white/10 hover:text-neutral-200"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Сбросить раскладку</span>
          </button>
        )}
      </div>

      {readOnly && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/90">
          <Eye className="h-4 w-4" />
          Режим просмотра чужих заметок — только чтение.
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="Заметок нет"
          description={
            readOnly
              ? "У этого пользователя пока нет заметок."
              : "Создайте первую заметку — план, идея, черновик, что угодно."
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Ничего не найдено"
          description={`По запросу «${search.trim()}» заметок нет.`}
        />
      ) : canvasMode ? (
        <NotesCanvas notes={notes} onOpen={setViewing} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setViewing(n)}
              className="text-left"
            >
              <NoteCardInner note={n} />
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <NoteViewer
          note={viewing}
          readOnly={readOnly}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditor({ note: viewing });
            setViewing(null);
          }}
        />
      )}

      {editor && (
        <NoteEditor note={editor.note} onClose={() => setEditor(null)} />
      )}
    </div>
  );
}

/* ── Free-canvas layout (desktop, own notes) ─────────────────────── */

function NotesCanvas({
  notes,
  onOpen,
}: {
  notes: NoteView[];
  onOpen: (n: NoteView) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    const measure = () => setWidth(canvasRef.current?.clientWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Seed positions: saved x/y from the server, a grid default for the rest.
  useEffect(() => {
    if (!width) return;
    const perRow = Math.max(1, Math.floor((width + GAP) / (CARD_W + GAP)));
    setPos((prev) => {
      const next = { ...prev };
      notes.forEach((n, i) => {
        if (next[n.id]) return;
        if (n.x != null && n.y != null) {
          next[n.id] = { x: n.x, y: n.y };
        } else {
          next[n.id] = {
            x: (i % perRow) * (CARD_W + GAP),
            y: Math.floor(i / perRow) * (DEFAULT_ROW_H + GAP),
          };
        }
      });
      for (const id of Object.keys(next)) {
        if (!notes.some((n) => n.id === id)) delete next[id];
      }
      return next;
    });
  }, [width, notes]);

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
      moveNote(id, nx, ny);
      return { ...prev, [id]: { x: nx, y: ny } };
    });
  }

  const contentBottom =
    Math.max(0, ...notes.map((n) => pos[n.id]?.y ?? 0)) + DEFAULT_ROW_H + 40;
  const canvasHeight = Math.max(480, contentBottom);

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div ref={canvasRef} className="relative w-full" style={{ height: canvasHeight }}>
        {notes.map((n) => {
          const p = pos[n.id];
          if (!p) return null;
          return <NoteTile key={n.id} note={n} pos={p} onOpen={onOpen} />;
        })}
      </div>
    </DndContext>
  );
}

function NoteTile({
  note,
  pos,
  onOpen,
}: {
  note: NoteView;
  pos: { x: number; y: number };
  onOpen: (n: NoteView) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: note.id });

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
      // dnd-kit swallows the click that follows a real drag, so a plain click
      // opens the note while a drag only moves it.
      onClick={() => onOpen(note)}
      className={cn(
        "cursor-grab select-none active:cursor-grabbing",
        isDragging && "opacity-80",
      )}
    >
      <NoteCardInner note={note} />
    </div>
  );
}

/* ── Card, viewer, editor ────────────────────────────────────────── */

function NoteCardInner({ note }: { note: NoteView }) {
  const preview = stripMd(note.body);
  return (
    <motion.div
      layout
      className="glass flex h-full flex-col overflow-hidden rounded-2xl transition hover:border-white/20"
    >
      <div className="h-1.5 shrink-0" style={{ backgroundColor: note.color ?? "#64748b" }} />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate font-semibold text-neutral-100">
            {note.title || "Без названия"}
          </h3>
          {note.pinned && (
            <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          )}
        </div>
        {preview ? (
          <p className="line-clamp-2 text-sm text-neutral-400">{preview}</p>
        ) : (
          <p className="text-sm text-neutral-600">Пусто</p>
        )}
        <span className="mt-auto pt-2 text-[11px] text-neutral-600">
          {fmtDate(note.updatedAt)}
        </span>
      </div>
    </motion.div>
  );
}

function NoteViewer({
  note,
  readOnly,
  onClose,
  onEdit,
}: {
  note: NoteView;
  readOnly: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  function pin() {
    start(async () => {
      await toggleNotePin(note.id);
      onClose();
      router.refresh();
    });
  }

  async function remove() {
    const ok = await confirm({
      title: "Удалить заметку?",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (ok)
      start(async () => {
        await deleteNote(note.id);
        onClose();
        router.refresh();
      });
  }

  return (
    <Modal open onClose={onClose} title={note.title || "Заметка"}>
      <div className="space-y-4">
        <div className="max-h-[55vh] overflow-y-auto text-neutral-200">
          {note.body.trim() ? (
            <Markdown>{note.body}</Markdown>
          ) : (
            <span className="text-sm text-neutral-600">Пустая заметка</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
          <span className="text-[11px] text-neutral-600">
            Изменено {fmtDate(note.updatedAt)}
          </span>
          {!readOnly && (
            <div className="flex items-center gap-1">
              <IconBtn onClick={pin} disabled={pending} title={note.pinned ? "Открепить" : "Закрепить"}>
                {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </IconBtn>
              <IconBtn onClick={remove} disabled={pending} title="Удалить" danger>
                <Trash2 className="h-4 w-4" />
              </IconBtn>
              <Button type="button" onClick={onEdit} className="ml-1">
                <Pencil className="h-4 w-4" />
                Редактировать
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function NoteEditor({
  note,
  onClose,
}: {
  note: NoteView | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [color, setColor] = useState(note?.color ?? NOTE_COLORS[0]);
  const [pending, start] = useTransition();

  function save() {
    if (!title.trim() && !body.trim()) return;
    start(async () => {
      if (note) await updateNote(note.id, title, body, color);
      else await createNote(title, body, color);
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open onClose={onClose} title={note ? "Редактирование" : "Новая заметка"}>
      <div className="space-y-4">
        <Field label="Заголовок" htmlFor="note-title">
          <Input
            id="note-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Необязательно"
            autoFocus
          />
        </Field>
        <Field label="Текст">
          <MarkdownEditor value={body} onChange={setBody} rows={10} />
        </Field>
        <Field label="Цвет">
          <div className="flex flex-wrap gap-2">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={cn(
                  "h-7 w-7 rounded-full transition",
                  color === c
                    ? "ring-2 ring-white ring-offset-2 ring-offset-neutral-900"
                    : "opacity-70 hover:opacity-100",
                )}
              />
            ))}
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            loading={pending}
            onClick={save}
            disabled={!title.trim() && !body.trim()}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded-lg p-2 text-neutral-500 transition hover:bg-white/5 disabled:opacity-40",
        danger ? "hover:text-red-400" : "hover:text-neutral-200",
      )}
    >
      {children}
    </button>
  );
}
