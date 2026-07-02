"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Smile,
  Pencil,
  Trash2,
  Check,
  X,
  FileText,
  Download,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { MediaLightbox } from "@/components/ui/media-lightbox";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { cn } from "@/lib/cn";
import { formatLastSeen } from "@/lib/presence";
import { useOnline } from "@/components/presence-provider";
import { useConfirm } from "@/components/ui/dialog-provider";
import {
  sendMessage,
  markRead,
  editMessage,
  deleteMessage,
  type ChatState,
} from "./actions";
import type { ActiveChannel, ChatMessage, ChatUser } from "./messages-client";
import { renderWithMentions } from "@/lib/render-mentions";

const EMOJIS = "😀 😁 😂 🤣 😊 😍 😘 😎 🤔 😴 😢 😭 😡 👍 👎 👏 🙏 🔥 🎉 ✅ ❌ ❤️ 💯 🚀 👀 💪 🤝 😅 😉 🙌 ✨ ⭐ 💡 📌 ⚡ 🥳".split(" ");
const MB = 1024 * 1024;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
  });
}
function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / MB).toFixed(1)} МБ`;
}

type PendingAttachment = {
  url: string;
  type: string;
  name: string;
  size: number;
};

type LightboxState =
  | { kind: "image"; src: string; name?: string }
  | { kind: "video"; src: string; name?: string }
  | null;

export function ConversationView({
  active,
  users = [],
  readOnly = false,
}: {
  active: ActiveChannel;
  users?: ChatUser[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [, startEdit] = useTransition();
  const [, startDel] = useTransition();
  const [state, action, pending] = useActionState<ChatState, FormData>(
    sendMessage,
    {},
  );
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isBoard = active.type === "BOARD";
  const otherOnline = useOnline(active.otherUserId ?? "", active.otherLastSeen);

  useEffect(() => {
    const es = new EventSource(`/api/channels/${active.channelId}/stream`);
    es.addEventListener("change", () => router.refresh());
    return () => es.close();
  }, [active.channelId, router]);

  useEffect(() => {
    markRead(active.channelId);
  }, [active.channelId, active.messages.length]);

  useEffect(() => {
    if (state.ok) {
      setBody("");
      setAttachment(null);
    }
  }, [state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [active.messages.length, active.channelId]);

  async function handleFile(file: File) {
    setUploadError(null);
    const img = file.type.startsWith("image/");
    const vid = file.type.startsWith("video/");
    const limit = img ? 25 * MB : vid ? Infinity : 50 * MB;
    if (file.size > limit) {
      setUploadError(img ? "Фото не больше 25 МБ" : "Файл не больше 50 МБ");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setUploadError(j.error ?? "Не удалось загрузить");
        return;
      }
      const data = await res.json();
      setAttachment({ url: data.url, type: data.kind, name: data.name, size: data.size });
    } catch {
      setUploadError("Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  function saveEdit(id: string) {
    const text = editValue.trim();
    if (text) startEdit(() => editMessage(id, text));
    setEditingId(null);
  }

  const canSend = (body.trim().length > 0 || attachment !== null) && !uploading;
  let lastDay = "";

  return (
    <>
    <MediaLightbox item={lightbox} onClose={() => setLightbox(null)} />
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="glass flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <Link
          href="/messages"
          className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/5 hover:text-neutral-200 md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {isBoard ? (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ background: active.color ?? "#0ea5e9" }}
          >
            #
          </span>
        ) : (
          <Avatar
            image={active.otherAvatar}
            emoji={active.otherEmoji}
            initials={active.title.slice(0, 2).toUpperCase()}
            size={38}
            online={otherOnline}
          />
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-100">{active.title}</p>
          <p
            className={cn(
              "truncate text-xs",
              !isBoard && !readOnly && otherOnline
                ? "text-emerald-400"
                : "text-neutral-500",
            )}
          >
            {isBoard || readOnly
              ? active.subtitle
              : otherOnline
                ? "в сети"
                : formatLastSeen(active.otherLastSeen)}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4">
        {active.messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-neutral-500">
            Сообщений пока нет. Начните разговор 👋
          </p>
        )}
        {active.messages.map((m) => {
          const day = formatDay(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-3 text-center">
                  <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs text-neutral-400">
                    {day}
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "group flex items-end gap-2",
                  m.mine ? "justify-end" : "justify-start",
                )}
              >
                {!m.mine && (
                  <Avatar
                    image={m.authorAvatar}
                    emoji={m.authorEmoji}
                    initials={m.authorInitials}
                    size={28}
                    className="self-end"
                  />
                )}

                {m.mine && editingId !== m.id && (
                  <MessageActions
                    onEdit={
                      m.body
                        ? () => {
                            setEditingId(m.id);
                            setEditValue(m.body);
                          }
                        : undefined
                    }
                    onDelete={async () => {
                      const ok = await confirm({
                        title: "Удалить сообщение?",
                        confirmLabel: "Удалить",
                        danger: true,
                      });
                      if (ok) startDel(() => deleteMessage(m.id));
                    }}
                  />
                )}

                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[70%]",
                    m.mine
                      ? "rounded-br-md bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sky-500/20"
                      : "rounded-bl-md border border-white/10 bg-white/[0.06] text-neutral-100 backdrop-blur",
                  )}
                >
                  {!m.mine && isBoard && (
                    <p className="mb-0.5 text-xs font-medium text-sky-300">
                      {m.authorName}
                    </p>
                  )}

                  {editingId === m.id ? (
                    <div className="w-56">
                      <textarea
                        value={editValue}
                        autoFocus
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            saveEdit(m.id);
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        rows={2}
                        className="w-full resize-none rounded-lg border border-white/20 bg-black/20 px-2 py-1 text-base sm:text-sm text-white outline-none"
                      />
                      <div className="mt-1 flex justify-end gap-1">
                        <button onClick={() => setEditingId(null)} title="Отмена">
                          <X className="h-4 w-4" />
                        </button>
                        <button onClick={() => saveEdit(m.id)} title="Сохранить">
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Attachment m={m} onOpen={setLightbox} />
                      {m.body && (
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {renderWithMentions(m.body)}
                        </p>
                      )}
                      <p
                        className={cn(
                          "mt-0.5 text-right text-[10px]",
                          m.mine ? "text-sky-200/80" : "text-neutral-500",
                        )}
                      >
                        {m.editedAt && "ред. · "}
                        {formatTime(m.createdAt)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer (hidden while an admin spectates someone else's chat) */}
      {readOnly ? (
        <div className="flex items-center justify-center gap-2 border-t border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-neutral-500">
          <Eye className="h-4 w-4" />
          Режим просмотра — переписка доступна только для чтения
        </div>
      ) : (
        <>
      {attachment && (
        <div className="flex items-center gap-2 border-t border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-300">
          <Paperclip className="h-4 w-4 text-sky-400" />
          <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
          <span className="text-xs text-neutral-500">{formatSize(attachment.size)}</span>
          <button onClick={() => setAttachment(null)} className="text-neutral-500 hover:text-red-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {uploadError && (
        <p className="border-t border-white/10 px-3 py-1.5 text-xs text-red-300">{uploadError}</p>
      )}

      <form action={action} className="relative flex items-end gap-2 border-t border-white/10 p-3">
        <input type="hidden" name="channelId" value={active.channelId} />
        {attachment && (
          <>
            <input type="hidden" name="attachmentUrl" value={attachment.url} />
            <input type="hidden" name="attachmentType" value={attachment.type} />
            <input type="hidden" name="attachmentName" value={attachment.name} />
            <input type="hidden" name="attachmentSize" value={attachment.size} />
          </>
        )}

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Прикрепить файл"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200 disabled:opacity-50"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            title="Эмодзи"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200"
          >
            <Smile className="h-5 w-5" />
          </button>
          {emojiOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} />
              <div className="glass-strong absolute bottom-12 left-0 z-20 grid w-64 grid-cols-8 gap-1 rounded-xl p-2 shadow-2xl">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setBody((b) => b + e);
                      setEmojiOpen(false);
                    }}
                    className="flex items-center justify-center rounded-lg p-1 text-lg leading-none hover:bg-white/10"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <MentionTextarea
          name="body"
          value={body}
          onChange={setBody}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) (e.target as HTMLTextAreaElement).form?.requestSubmit();
            }
          }}
          rows={1}
          placeholder={uploading ? "Загрузка файла…" : "Сообщение… (@ — упомянуть)"}
          users={users}
          wrapperClassName="flex-1"
          className="max-h-32 min-h-[40px] w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base sm:text-sm text-neutral-100 outline-none backdrop-blur focus:border-sky-500/70 focus:ring-2 focus:ring-sky-500/25"
        />
        <Button type="submit" loading={pending} disabled={!canSend}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
        </>
      )}
    </div>
    </>
  );
}

function MessageActions({
  onEdit,
  onDelete,
}: {
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 self-center opacity-0 transition group-hover:opacity-100">
      {onEdit && (
        <button
          onClick={onEdit}
          title="Редактировать"
          className="rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-sky-400"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onDelete}
        title="Удалить"
        className="rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Attachment({
  m,
  onOpen,
}: {
  m: ChatMessage;
  onOpen: (item: { kind: "image" | "video"; src: string; name?: string }) => void;
}) {
  if (!m.attachmentUrl) return null;
  if (m.attachmentType === "image") {
    return (
      <button
        type="button"
        onClick={() =>
          onOpen({ kind: "image", src: m.attachmentUrl!, name: m.attachmentName ?? undefined })
        }
        className="mb-1 block w-full overflow-hidden rounded-lg"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={m.attachmentUrl}
          alt={m.attachmentName ?? ""}
          className="max-h-64 w-auto max-w-full rounded-lg transition hover:brightness-90"
          draggable={false}
        />
      </button>
    );
  }
  if (m.attachmentType === "video") {
    return (
      <button
        type="button"
        onClick={() =>
          onOpen({ kind: "video", src: m.attachmentUrl!, name: m.attachmentName ?? undefined })
        }
        className="group relative mb-1 block overflow-hidden rounded-lg"
      >
        <video
          src={m.attachmentUrl}
          className="max-h-64 w-auto max-w-full rounded-lg"
          muted
          preload="metadata"
        />
        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 opacity-0 transition group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 translate-x-0.5 text-white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </button>
    );
  }
  return (
    <a
      href={m.attachmentUrl}
      target="_blank"
      rel="noreferrer"
      download
      className="mb-1 flex items-center gap-2 rounded-lg bg-black/15 px-2.5 py-2"
    >
      <FileText className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{m.attachmentName}</span>
      </span>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}
