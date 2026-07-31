"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  StickyNote,
  Eye,
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
import { createNote, updateNote, deleteNote, toggleNotePin } from "./actions";

export type NoteView = {
  id: string;
  title: string | null;
  body: string;
  color: string | null;
  pinned: boolean;
  updatedAt: string;
};

const NOTE_COLORS = [
  "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#f59e0b", "#10b981", "#14b8a6", "#64748b",
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  // null = closed; { note: null } = new; { note } = edit existing.
  const [editor, setEditor] = useState<{ note: NoteView | null } | null>(null);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Заметки</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {readOnly
              ? `Заметки пользователя: ${targetName ?? "—"}`
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {notes.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                readOnly={readOnly}
                onEdit={() => setEditor({ note: n })}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {editor && (
        <NoteModal note={editor.note} onClose={() => setEditor(null)} />
      )}
    </div>
  );
}

function NoteCard({
  note,
  readOnly,
  onEdit,
}: {
  note: NoteView;
  readOnly: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  function pin() {
    start(async () => {
      await toggleNotePin(note.id);
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
        router.refresh();
      });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="glass relative flex flex-col overflow-hidden rounded-2xl"
    >
      <div className="h-1.5" style={{ backgroundColor: note.color ?? "#64748b" }} />
      {note.pinned && (
        <span className="absolute right-2 top-3.5 text-amber-400" title="Закреплено">
          <Pin className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="flex flex-1 flex-col p-4">
        {note.title && (
          <h3 className="mb-1.5 pr-5 font-semibold text-neutral-100">{note.title}</h3>
        )}
        <div className="flex-1 text-neutral-300">
          {note.body.trim() ? (
            <Markdown compact>{note.body}</Markdown>
          ) : (
            <span className="text-sm text-neutral-600">Пусто</span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-neutral-600">{fmtDate(note.updatedAt)}</span>
          {!readOnly && (
            <div className="flex items-center gap-0.5">
              <IconBtn onClick={pin} disabled={pending} title={note.pinned ? "Открепить" : "Закрепить"}>
                {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </IconBtn>
              <IconBtn onClick={onEdit} title="Редактировать">
                <Pencil className="h-4 w-4" />
              </IconBtn>
              <IconBtn onClick={remove} disabled={pending} title="Удалить" danger>
                <Trash2 className="h-4 w-4" />
              </IconBtn>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function NoteModal({
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
    <Modal open onClose={onClose} title={note ? "Заметка" : "Новая заметка"}>
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
          <MarkdownEditor value={body} onChange={setBody} rows={9} />
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
        "rounded-lg p-1.5 text-neutral-500 transition hover:bg-white/5 disabled:opacity-40",
        danger ? "hover:text-red-400" : "hover:text-neutral-200",
      )}
    >
      {children}
    </button>
  );
}
