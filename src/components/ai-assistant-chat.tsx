"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Eraser,
  LayoutGrid,
  ListTodo,
  Loader2,
  Maximize2,
  Minimize2,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Markdown } from "@/components/ui/markdown";
import { useConfirm } from "@/components/ui/dialog-provider";
import { cn } from "@/lib/cn";
import { detectAiReferenceTrigger } from "@/lib/ai/reference-input";
import { aiComposerHeight } from "@/lib/ai/composer-size";
import { aiReferenceHref } from "@/lib/ai/reference-links";

type AiAction = {
  tool: string;
  label: string;
  success: boolean;
  href?: string;
};

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: AiAction[];
  references: AiReference[];
  createdAt: string;
  pending?: boolean;
  failed?: boolean;
};

type AiReferenceType = "user" | "project" | "task";

type AiReference = {
  type: AiReferenceType;
  id: string;
  label: string;
  marker: string;
  detail?: string;
  boardId?: string;
  color?: string;
  initials?: string;
  avatar?: string | null;
  emoji?: string | null;
};

type ReferencePicker = {
  type: AiReferenceType;
  start: number;
  query: string;
};

type AiProgressEvent = {
  id: string;
  label: string;
  status: "active" | "done" | "error";
  round?: number;
  tool?: string;
};

type AiProgress = {
  active: boolean;
  events: AiProgressEvent[];
};

const SUGGESTIONS = [
  "Покажи мои актуальные задачи",
  "Найди просроченные задачи и кратко объясни риски",
  "Помоги создать новую задачу",
];

const subscribeToHydration = () => () => undefined;

export function AiAssistantChat({
  open,
  onClose,
  configured,
  desktopLeft,
}: {
  open: boolean;
  onClose: () => void;
  configured: boolean;
  desktopLeft: number;
}) {
  const confirm = useConfirm();
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [references, setReferences] = useState<AiReference[]>([]);
  const [referencePicker, setReferencePicker] = useState<ReferencePicker | null>(null);
  const [referenceItems, setReferenceItems] = useState<AiReference[]>([]);
  const [activeReference, setActiveReference] = useState(0);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<AiProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRequest = useRef(false);

  useEffect(() => {
    if (!open) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const resizeComposer = () => {
      textarea.style.height = "0px";
      const height = aiComposerHeight(
        textarea.scrollHeight,
        window.innerHeight,
        composerExpanded,
      );
      textarea.style.height = `${height}px`;
      textarea.style.overflowY = textarea.scrollHeight > height ? "auto" : "hidden";
    };
    resizeComposer();
    window.addEventListener("resize", resizeComposer);
    return () => window.removeEventListener("resize", resizeComposer);
  }, [composerExpanded, input, open]);

  useEffect(() => {
    if (!referencePicker || (referencePicker.type === "task" && referencePicker.query.length < 2)) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setReferencesLoading(true);
      try {
        const params = new URLSearchParams({
          type: referencePicker.type,
          q: referencePicker.query,
        });
        const response = await fetch(`/api/ai/references?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json() as { ok?: boolean; items?: AiReference[] };
        if (response.ok && data.ok) {
          setReferenceItems(data.items ?? []);
          setActiveReference(0);
        }
      } catch {
        if (!controller.signal.aborted) setReferenceItems([]);
      } finally {
        if (!controller.signal.aborted) setReferencesLoading(false);
      }
    }, 140);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [referencePicker]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || loaded || historyRequest.current) return;
    historyRequest.current = true;
    fetch("/api/ai/chat", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as {
          ok?: boolean;
          messages?: AiMessage[];
          error?: string;
        };
        if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось загрузить чат.");
        setMessages(data.messages ?? []);
        setLoaded(true);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить чат.");
      })
      .finally(() => {
        setLoaded(true);
        historyRequest.current = false;
      });
  }, [loaded, open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, progress, loaded, open]);

  useEffect(() => {
    if (open && loaded) textareaRef.current?.focus();
  }, [loaded, open]);

  useEffect(() => {
    if (!loading) return;
    let cancelled = false;

    async function loadProgress() {
      try {
        const response = await fetch("/api/ai/status", { cache: "no-store" });
        const data = await response.json() as {
          ok?: boolean;
          progress?: AiProgress;
        };
        if (!cancelled && response.ok && data.ok && data.progress) {
          setProgress(data.progress);
        }
      } catch {
        // The main chat request remains authoritative if progress polling fails.
      }
    }

    void loadProgress();
    const timer = window.setInterval(() => void loadProgress(), 700);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loading]);

  async function sendMessage(text = input) {
    const message = text.trim();
    if (!message || loading || !configured) return;
    const optimisticId = `pending-${crypto.randomUUID()}`;
    const optimistic: AiMessage = {
      id: optimisticId,
      role: "user",
      content: message,
      actions: [],
      references,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setInput("");
    setComposerExpanded(false);
    setReferences([]);
    setReferencePicker(null);
    setError(null);
    setProgress({
      active: true,
      events: [{
        id: optimisticId,
        label: "Отправляю запрос помощнику",
        status: "active",
      }],
    });
    setLoading(true);
    setMessages((current) => [...current, optimistic]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          references: references.map((reference) => ({
            type: reference.type,
            id: reference.id,
          })),
        }),
      });
      const data = await response.json() as {
        ok?: boolean;
        error?: string;
        userMessage?: AiMessage;
        assistantMessage?: AiMessage;
      };
      if (!response.ok || !data.ok || !data.userMessage || !data.assistantMessage) {
        throw new Error(data.error || "ИИ-помощник не ответил.");
      }
      setMessages((current) => [
        ...current.map((item) => item.id === optimisticId ? data.userMessage! : item),
        data.assistantMessage!,
      ]);
    } catch (reason) {
      const messageText = reason instanceof Error ? reason.message : "ИИ-помощник недоступен.";
      setError(messageText);
      setMessages((current) => current.map((item) => (
        item.id === optimisticId ? { ...item, pending: false, failed: true } : item
      )));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function clearHistory() {
    if (loading || messages.length === 0) return;
    const accepted = await confirm({
      title: "Очистить историю ИИ-чата?",
      message: "Сообщения будут удалены из базы данных только для вашего аккаунта.",
      confirmLabel: "Очистить",
      danger: true,
    });
    if (!accepted) return;
    const response = await fetch("/api/ai/chat", { method: "DELETE" });
    if (response.ok) {
      setMessages([]);
      setError(null);
    } else {
      setError("Не удалось очистить историю чата.");
    }
  }

  function onTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (referencePicker) {
      if (event.key === "ArrowDown" && referenceItems.length) {
        event.preventDefault();
        setActiveReference((current) => (current + 1) % referenceItems.length);
        return;
      }
      if (event.key === "ArrowUp" && referenceItems.length) {
        event.preventDefault();
        setActiveReference((current) => (current - 1 + referenceItems.length) % referenceItems.length);
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && referenceItems[activeReference]) {
        event.preventDefault();
        insertReference(referenceItems[activeReference]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setReferencePicker(null);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function updateInput(value: string, cursor: number) {
    setInput(value);
    const trigger = detectAiReferenceTrigger(
      value,
      cursor,
      references.map((reference) => reference.marker),
    );
    if (!trigger) {
      setReferencePicker(null);
      setReferenceItems([]);
      setReferencesLoading(false);
      return;
    }
    setReferencePicker(trigger);
    setReferenceItems([]);
    setReferencesLoading(false);
  }

  function insertReference(reference: AiReference) {
    if (!referencePicker) return;
    const cursor = textareaRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, referencePicker.start);
    const after = input.slice(cursor);
    const nextValue = `${before}${reference.marker} ${after}`;
    const nextCursor = before.length + reference.marker.length + 1;
    setInput(nextValue);
    setReferences((current) => current.some((item) => (
      item.type === reference.type && item.id === reference.id
    )) ? current : [...current, reference]);
    setReferencePicker(null);
    setReferenceItems([]);
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  }

  function removeReference(reference: AiReference) {
    setReferences((current) => current.filter((item) => !(
      item.type === reference.type && item.id === reference.id
    )));
    setInput((current) => current.replace(reference.marker, "").replace(/ {2,}/g, " "));
    textareaRef.current?.focus();
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Закрыть ИИ-помощника"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[240] bg-black/60 backdrop-blur-sm md:hidden"
          />
          <motion.section
            role="dialog"
            aria-label="ИИ-помощник ProjectRA"
            initial={{ opacity: 0, x: -20, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -16, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            style={{ "--assistant-left": `${desktopLeft}px` } as CSSProperties}
            className="glass-strong fixed inset-y-0 left-0 z-[250] flex w-full flex-col overflow-hidden border-white/10 shadow-2xl shadow-black/50 md:bottom-4 md:left-[var(--assistant-left)] md:top-auto md:h-[min(72vh,680px)] md:w-[420px] md:rounded-2xl md:border"
          >
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 px-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-lg shadow-sky-500/20">
                <Bot className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-100">
                  ИИ-помощник
                  <Sparkles className="h-3.5 w-3.5 text-sky-300" />
                </h2>
                <p className="truncate text-xs text-neutral-500">
                  Работает с ProjectRA от вашего имени
                </p>
              </div>
              <button
                type="button"
                title="Очистить историю"
                aria-label="Очистить историю"
                onClick={() => void clearHistory()}
                disabled={loading || messages.length === 0}
                className="rounded-lg p-2 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-200 disabled:opacity-30"
              >
                <Eraser className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Закрыть"
                aria-label="Закрыть"
                onClick={onClose}
                className="rounded-lg p-2 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-200"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {!loaded && (
                <div className="flex h-full items-center justify-center text-neutral-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}

              {loaded && messages.length === 0 && (
                <div className="flex min-h-full flex-col justify-center py-8">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 text-sky-300">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-center text-base font-semibold text-neutral-100">
                    Чем помочь с задачами?
                  </h3>
                  <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-5 text-neutral-500">
                    Могу найти, объяснить, создать, назначить, изменить или завершить задачу в пределах ваших прав.
                  </p>
                  <div className="mt-5 space-y-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setInput(suggestion);
                          textareaRef.current?.focus();
                        }}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-neutral-300 transition hover:border-sky-400/25 hover:bg-sky-500/5 hover:text-neutral-100"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div className={cn("max-w-[88%]", message.role === "user" && "text-right")}>
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-left text-sm leading-5",
                        message.role === "user"
                          ? "rounded-br-md bg-gradient-to-br from-sky-500 to-indigo-600 text-white"
                          : "rounded-bl-md border border-white/10 bg-white/[0.04] text-neutral-200",
                        message.failed && "border border-red-400/30 bg-red-500/10",
                        message.pending && "opacity-70",
                      )}
                    >
                      {message.role === "assistant" ? (
                        <Markdown compact>{message.content}</Markdown>
                      ) : (
                        <ReferencedText
                          content={message.content}
                          references={message.references}
                          onNavigate={onClose}
                        />
                      )}
                    </div>
                    {message.actions.length > 0 && (
                      <div className="mt-2 flex flex-col items-start gap-1.5">
                        {message.actions.map((action, index) => {
                          const Icon = action.success ? CheckCircle2 : AlertCircle;
                          const content = (
                            <span className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs",
                              action.success
                                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                                : "border-red-400/20 bg-red-500/10 text-red-300",
                            )}>
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              {action.label}
                            </span>
                          );
                          return action.href ? (
                            <Link key={`${action.tool}-${index}`} href={action.href} onClick={onClose}>
                              {content}
                            </Link>
                          ) : (
                            <span key={`${action.tool}-${index}`}>{content}</span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div
                    aria-live="polite"
                    className="w-[88%] rounded-2xl rounded-bl-md border border-sky-400/15 bg-gradient-to-br from-sky-500/[0.08] to-indigo-500/[0.04] px-3.5 py-3 text-sm"
                  >
                    <div className={cn(
                      "flex items-center gap-2",
                      progress?.events.at(-1)?.status === "error" ? "text-red-300" : "text-sky-200",
                    )}>
                      {progress?.events.at(-1)?.status === "done" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                      ) : progress?.events.at(-1)?.status === "error" ? (
                        <AlertCircle className="h-4 w-4 shrink-0" />
                      ) : (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      )}
                      <span className="font-medium">
                        {progress?.events.at(-1)?.label ?? "Запускаю помощника"}
                      </span>
                      {progress?.events.at(-1)?.round && (
                        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-neutral-600">
                          раунд {progress.events.at(-1)?.round}
                        </span>
                      )}
                    </div>
                    {progress && progress.events.length > 1 && (
                      <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-2">
                        {progress.events.slice(-5, -1).map((event) => (
                          <div
                            key={event.id}
                            className={cn(
                              "flex items-center gap-2 text-xs",
                              event.status === "error" ? "text-red-300" : "text-neutral-500",
                            )}
                          >
                            {event.status === "error" ? (
                              <AlertCircle className="h-3 w-3 shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400/70" />
                            )}
                            <span>{event.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <footer className="shrink-0 border-t border-white/10 bg-neutral-950/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {error && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}
              {!configured && (
                <div className="mb-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Администратору нужно задать `OPENROUTER_API_KEY` и перезапустить ProjectRA.
                </div>
              )}
              <div className="relative rounded-xl border border-white/10 bg-white/[0.04] p-2 focus-within:border-sky-400/35 focus-within:ring-1 focus-within:ring-sky-400/20">
                {referencePicker && (
                  <ReferenceSuggestions
                    type={referencePicker.type}
                    query={referencePicker.query}
                    items={referenceItems}
                    active={activeReference}
                    loading={referencesLoading}
                    onSelect={insertReference}
                    onHover={setActiveReference}
                  />
                )}
                {references.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1.5 border-b border-white/[0.06] pb-2">
                    {references.map((reference) => (
                      <ReferenceChip
                        key={`${reference.type}:${reference.id}`}
                        reference={reference}
                        onRemove={() => removeReference(reference)}
                      />
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(event) => updateInput(
                      event.target.value,
                      event.target.selectionStart ?? event.target.value.length,
                    )}
                    onKeyDown={onTextareaKeyDown}
                    onBlur={() => setReferencePicker(null)}
                    placeholder="Напишите, что нужно сделать…"
                    rows={1}
                    maxLength={8_000}
                    disabled={!configured || loading}
                    className="min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm leading-5 text-neutral-100 outline-none placeholder:text-neutral-600 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    title={composerExpanded ? "Свернуть поле ввода" : "Развернуть поле ввода"}
                    aria-label={composerExpanded ? "Свернуть поле ввода" : "Развернуть поле ввода"}
                    onClick={() => {
                      setComposerExpanded((current) => !current);
                      textareaRef.current?.focus();
                    }}
                    disabled={!configured || loading}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/5 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {composerExpanded
                      ? <Minimize2 className="h-4 w-4" />
                      : <Maximize2 className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    aria-label="Отправить"
                    onClick={() => void sendMessage()}
                    disabled={!configured || loading || !input.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-neutral-600">
                @ сотрудник · # доска · $ задача · Enter — отправить
              </p>
            </footer>
          </motion.section>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ReferenceSuggestions({
  type,
  query,
  items,
  active,
  loading,
  onSelect,
  onHover,
}: {
  type: AiReferenceType;
  query: string;
  items: AiReference[];
  active: number;
  loading: boolean;
  onSelect: (reference: AiReference) => void;
  onHover: (index: number) => void;
}) {
  const emptyLabel = type === "task" && query.length < 2
    ? "Введите минимум 2 символа для поиска задачи"
    : "Ничего не найдено";
  return (
    <div className="glass-strong absolute bottom-full left-0 right-0 z-30 mb-2 max-h-72 overflow-y-auto rounded-xl border border-white/10 p-1.5 shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        <ReferenceTypeIcon type={type} className="h-3.5 w-3.5" />
        {type === "user" ? "Сотрудники" : type === "project" ? "Доски" : "Задачи"}
      </div>
      {loading ? (
        <div className="flex items-center justify-center gap-2 px-3 py-5 text-xs text-neutral-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Ищу…
        </div>
      ) : items.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-neutral-500">{emptyLabel}</p>
      ) : items.map((reference, index) => (
        <button
          key={`${reference.type}:${reference.id}`}
          type="button"
          onMouseEnter={() => onHover(index)}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(reference);
          }}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
            index === active ? "bg-sky-500/15" : "hover:bg-white/5",
          )}
        >
          {reference.type === "user" ? (
            <Avatar
              image={reference.avatar ?? null}
              emoji={reference.emoji ?? null}
              initials={reference.initials ?? "?"}
              size={30}
            />
          ) : (
            <span
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-white/[0.06]"
              style={{ color: reference.color ?? "#38bdf8" }}
            >
              <ReferenceTypeIcon type={reference.type} className="h-4 w-4" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-neutral-100">{reference.label}</span>
            {reference.detail && (
              <span className="block truncate text-xs text-neutral-500">{reference.detail}</span>
            )}
          </span>
          <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-600">
            {reference.type === "user" ? "@" : reference.type === "project" ? "#" : "$"}
          </kbd>
        </button>
      ))}
    </div>
  );
}

function ReferenceChip({
  reference,
  onRemove,
}: {
  reference: AiReference;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-sky-400/20 bg-sky-500/10 py-1 pl-1.5 pr-1 text-xs text-sky-200">
      <ReferenceTypeIcon type={reference.type} className="h-3 w-3 shrink-0" />
      <span className="max-w-48 truncate">{reference.marker}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Убрать ссылку ${reference.label}`}
        className="rounded p-0.5 text-sky-300/60 transition hover:bg-white/10 hover:text-sky-100"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function ReferenceTypeIcon({
  type,
  className,
}: {
  type: AiReferenceType;
  className?: string;
}) {
  if (type === "user") return <UserRound className={className} />;
  if (type === "project") return <LayoutGrid className={className} />;
  return <ListTodo className={className} />;
}

function ReferencedText({
  content,
  references,
  onNavigate,
}: {
  content: string;
  references: AiReference[];
  onNavigate: () => void;
}) {
  if (!references.length) return <span className="whitespace-pre-wrap">{content}</span>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  while (cursor < content.length) {
    const matches = references
      .map((reference) => ({ reference, index: content.indexOf(reference.marker, cursor) }))
      .filter((match) => match.index >= 0)
      .sort((left, right) => left.index - right.index || right.reference.marker.length - left.reference.marker.length);
    const next = matches[0];
    if (!next) {
      parts.push(<span key={key++}>{content.slice(cursor)}</span>);
      break;
    }
    if (next.index > cursor) {
      parts.push(<span key={key++}>{content.slice(cursor, next.index)}</span>);
    }
    const tokenClassName = cn(
      "mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border border-white/20 bg-white/15 px-1.5 py-0.5 align-baseline text-[0.82rem] font-medium text-white",
      next.reference.type !== "user" && "cursor-pointer transition hover:border-white/40 hover:bg-white/25",
    );
    const tokenContent = (
      <>
        <ReferenceTypeIcon type={next.reference.type} className="h-3 w-3 shrink-0" />
        <span className="truncate">{next.reference.marker}</span>
      </>
    );
    const href = aiReferenceHref(next.reference);
    parts.push(href ? (
      <Link
        key={key++}
        href={href}
        title={next.reference.detail}
        onClick={onNavigate}
        className={tokenClassName}
      >
        {tokenContent}
      </Link>
    ) : (
      <span
        key={key++}
        title={next.reference.detail}
        className={tokenClassName}
      >
        {tokenContent}
      </span>
    ));
    cursor = next.index + next.reference.marker.length;
  }
  return <span className="whitespace-pre-wrap">{parts}</span>;
}
