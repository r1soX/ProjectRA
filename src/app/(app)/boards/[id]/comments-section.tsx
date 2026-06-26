"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Send, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  addComment,
  deleteComment,
  editComment,
  type ActionState,
} from "../actions";
import type { BoardTask } from "./board-view";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommentsSection({
  taskId,
  comments,
  currentUserId,
  canModerate,
}: {
  taskId: string;
  comments: BoardTask["comments"];
  currentUserId: string;
  canModerate: boolean;
}) {
  const [body, setBody] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addComment,
    {},
  );
  const [delPending, startDel] = useTransition();
  const [, startEdit] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (state.ok) setBody("");
  }, [state]);

  function saveEdit(id: string) {
    const text = editValue.trim();
    if (text) startEdit(() => editComment(id, text));
    setEditingId(null);
  }

  return (
    <div className="pt-1">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-neutral-300">
        <MessageSquare className="h-4 w-4 text-neutral-500" />
        Комментарии
        {comments.length > 0 && (
          <span className="rounded-full bg-white/10 px-1.5 text-xs text-neutral-300">
            {comments.length}
          </span>
        )}
      </p>

      <div className="mb-3 max-h-[40vh] min-h-[60px] space-y-3 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {comments.map((c) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-2.5"
            >
              <Avatar
                image={c.authorAvatar}
                emoji={c.authorEmoji}
                initials={c.authorInitials}
                size={28}
              />
              <div className="min-w-0 flex-1 rounded-lg bg-white/[0.05] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-neutral-200">
                    {c.authorName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-500">
                      {formatTime(c.createdAt)}
                    </span>
                    {c.userId === currentUserId && editingId !== c.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditValue(c.body);
                        }}
                        className="text-neutral-600 transition hover:text-sky-400"
                        title="Редактировать"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {(c.userId === currentUserId || canModerate) && (
                      <button
                        type="button"
                        disabled={delPending}
                        onClick={() => startDel(() => deleteComment(c.id))}
                        className="text-neutral-600 transition hover:text-red-400"
                        title="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {editingId === c.id ? (
                  <div className="mt-1.5">
                    <textarea
                      value={editValue}
                      autoFocus
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          saveEdit(c.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-neutral-100 outline-none focus:border-sky-500"
                    />
                    <div className="mt-1 flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-md p-1 text-neutral-400 hover:bg-white/5"
                        title="Отмена"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(c.id)}
                        className="rounded-md p-1 text-sky-400 hover:bg-white/5"
                        title="Сохранить"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-neutral-200">
                    {c.body}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {comments.length === 0 && (
          <p className="text-xs text-neutral-500">Пока нет комментариев.</p>
        )}
      </div>

      <form action={action} className="flex items-end gap-2">
        <input type="hidden" name="taskId" value={taskId} />
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={3}
          placeholder="Написать комментарий… (Ctrl/⌘+Enter — отправить)"
          className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-neutral-100 outline-none backdrop-blur focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/25"
        />
        <Button type="submit" loading={pending} disabled={!body.trim()} className="self-end">
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Отправить</span>
        </Button>
      </form>
      {state.error && (
        <p className="mt-1 text-xs text-red-300">{state.error}</p>
      )}
    </div>
  );
}
