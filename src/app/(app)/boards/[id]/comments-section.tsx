"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addComment, deleteComment, type ActionState } from "../actions";
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

  useEffect(() => {
    if (state.ok) setBody("");
  }, [state]);

  return (
    <div className="border-t border-neutral-800 pt-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-neutral-300">
        <MessageSquare className="h-4 w-4 text-neutral-500" />
        Комментарии
        {comments.length > 0 && (
          <span className="rounded-full bg-neutral-800 px-1.5 text-xs text-neutral-400">
            {comments.length}
          </span>
        )}
      </p>

      <div className="mb-3 max-h-56 space-y-3 overflow-y-auto pr-1">
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
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-[10px] font-semibold text-white">
                {c.authorInitials}
              </span>
              <div className="min-w-0 flex-1 rounded-lg bg-neutral-800/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-neutral-200">
                    {c.authorName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-500">
                      {formatTime(c.createdAt)}
                    </span>
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
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-neutral-200">
                  {c.body}
                </p>
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
          rows={2}
          placeholder="Написать комментарий…"
          className="flex-1 resize-none rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
        />
        <Button type="submit" loading={pending} disabled={!body.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
      {state.error && (
        <p className="mt-1 text-xs text-red-300">{state.error}</p>
      )}
    </div>
  );
}
