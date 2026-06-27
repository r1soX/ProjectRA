"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Send, Trash2, Pencil, Check, X, SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import {
  addComment,
  deleteComment,
  editComment,
  toggleCommentReaction,
  type ActionState,
} from "../actions";
import { renderWithMentions } from "@/lib/render-mentions";
import { cn } from "@/lib/cn";
import type { BoardTask, DirectoryUser } from "./board-view";

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "😄", "🚀", "👀"];

function CommentReactions({ comment }: { comment: BoardTask["comments"][number] }) {
  const [, start] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const toggle = (emoji: string) => start(() => toggleCommentReaction(comment.id, emoji));
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {comment.reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => toggle(r.emoji)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition",
            r.mine
              ? "border-sky-500/50 bg-sky-500/15"
              : "border-neutral-700 bg-neutral-800/60 hover:bg-neutral-800",
          )}
        >
          <span>{r.emoji}</span>
          <span className="text-neutral-300">{r.count}</span>
        </button>
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-label="Добавить реакцию"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800/60 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
        >
          <SmilePlus className="h-3.5 w-3.5" />
        </button>
        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
            <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-xl border border-neutral-700 bg-neutral-800 p-1.5 shadow-xl">
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    toggle(e);
                    setPickerOpen(false);
                  }}
                  className="rounded-lg px-1.5 py-0.5 text-lg transition hover:bg-white/10"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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
  canView = true,
  canCreate = true,
  mentionUsers = [],
  highlightCommentId = null,
}: {
  taskId: string;
  comments: BoardTask["comments"];
  currentUserId: string;
  canModerate: boolean;
  canView?: boolean;
  canCreate?: boolean;
  mentionUsers?: DirectoryUser[];
  highlightCommentId?: string | null;
}) {
  const [body, setBody] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);
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

  // Deep-link from a @-mention notification: scroll to the comment and flash it.
  useEffect(() => {
    if (!highlightCommentId) return;
    const el = document.getElementById(`comment-${highlightCommentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(highlightCommentId);
    const t = setTimeout(() => setFlashId(null), 2200);
    return () => clearTimeout(t);
  }, [highlightCommentId, comments]);

  function saveEdit(id: string) {
    const text = editValue.trim();
    if (text) startEdit(() => editComment(id, text));
    setEditingId(null);
  }

  if (!canView) {
    return (
      <div className="pt-1">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-neutral-300">
          <MessageSquare className="h-4 w-4 text-neutral-500" />
          Комментарии
        </p>
        <p className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2.5 text-xs text-neutral-500">
          У вас нет прав на просмотр комментариев.
        </p>
      </div>
    );
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
              id={`comment-${c.id}`}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex scroll-mt-4 gap-2.5 rounded-lg p-1 transition-shadow ${
                flashId === c.id ? "bg-sky-500/[0.06] ring-2 ring-sky-400/70" : ""
              }`}
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
                      className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-base sm:text-sm text-neutral-100 outline-none focus:border-sky-500"
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
                    {renderWithMentions(c.body)}
                  </p>
                )}
                {editingId !== c.id && <CommentReactions comment={c} />}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {comments.length === 0 && (
          <p className="text-xs text-neutral-500">Пока нет комментариев.</p>
        )}
      </div>

      {canCreate ? (
        <>
      <form action={action} className="flex items-end gap-2">
        <input type="hidden" name="taskId" value={taskId} />
        <MentionTextarea
          name="body"
          value={body}
          onChange={setBody}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              (e.target as HTMLTextAreaElement).form?.requestSubmit();
            }
          }}
          rows={3}
          placeholder="Написать комментарий… (Ctrl/⌘+Enter — отправить, @ — упомянуть)"
          users={mentionUsers}
          wrapperClassName="flex-1"
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-base sm:text-sm text-neutral-100 outline-none backdrop-blur focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/25"
        />
        <Button type="submit" loading={pending} disabled={!body.trim()} className="self-end">
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Отправить</span>
        </Button>
      </form>
      {state.error && (
        <p className="mt-1 text-xs text-red-300">{state.error}</p>
      )}
        </>
      ) : (
        <p className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2.5 text-xs text-neutral-500">
          У вас нет прав на добавление комментариев.
        </p>
      )}
    </div>
  );
}
