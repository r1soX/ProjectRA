"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, MessageCircle, Hash, X, Check, Trash2 } from "lucide-react";
import { notifMeta, formatRelative, type NotifType } from "@/lib/notif-format";

// ── Types ─────────────────────────────────────────────────────────────────

interface RawEvent {
  type: "message" | "notification";
  // message fields
  channelId?: string;
  fromName?: string;
  preview?: string;
  title?: string;
  isBoard?: boolean;
  // notification fields
  notificationId?: string;
  notifType?: string;
  payload?: Record<string, unknown>;
  link?: string;
}

interface StoredNotif {
  id: string;
  type: NotifType;
  payload: Record<string, unknown>;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Toast {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  link?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function playPing() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
    setTimeout(() => ctx.close(), 700);
  } catch { /* audio blocked */ }
}

// ── Main component ────────────────────────────────────────────────────────

export function NotificationCenter({
  variant = "desktop",
}: {
  // AppShell mounts this twice (desktop sidebar + mobile header). Only the
  // instance matching the current breakpoint runs the SSE subscription and
  // renders the toasts/panel — otherwise every notification shows twice.
  variant?: "desktop" | "mobile";
}) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notifs, setNotifs] = useState<StoredNotif[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  // Panel & toasts are portaled to <body> so their z-index isn't trapped
  // inside the sidebar's stacking context (otherwise <main> paints over them
  // and steals their clicks).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Only the instance for the active breakpoint owns the SSE stream + overlays.
  const [active, setActive] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () =>
      setActive(variant === "desktop" ? mq.matches : !mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [variant]);

  const unread = notifs.filter((n) => !n.isRead).length;

  // Load notifications list
  async function loadNotifs() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/list");
      if (res.ok) setNotifs(await res.json());
    } finally {
      setLoading(false);
    }
  }

  // Mark notification(s) read
  async function markRead(id?: string) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    setNotifs((ns) =>
      ns.map((n) => (id ? (n.id === id ? { ...n, isRead: true } : n) : { ...n, isRead: true })),
    );
  }

  // Delete all notifications for the current user.
  async function clearAll() {
    setNotifs([]);
    await fetch("/api/notifications/clear", { method: "POST" });
  }

  // SSE — real-time events (only the active-breakpoint instance subscribes)
  useEffect(() => {
    if (!active) return;
    const es = new EventSource("/api/notifications/stream");

    es.addEventListener("message", (e) => {
      let raw: RawEvent;
      try { raw = JSON.parse((e as MessageEvent).data); } catch { return; }

      router.refresh();

      if (raw.type === "message") {
        // legacy chat message toast
        const viewing =
          window.location.pathname.startsWith("/messages") &&
          new URLSearchParams(window.location.search).get("c") === raw.channelId;
        if (viewing) return;
        playPing();
        const id = crypto.randomUUID();
        setToasts((t) => [
          ...t,
          {
            id,
            type: "message",
            title: raw.isBoard ? `# ${raw.title}` : raw.fromName ?? "",
            body: raw.isBoard ? `${raw.fromName}: ${raw.preview}` : raw.preview ?? "",
            link: `/messages?c=${raw.channelId}`,
          },
        ]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
        return;
      }

      if (raw.type === "notification" && raw.notifType) {
        playPing();
        const type = raw.notifType as NotifType;
        const payload = raw.payload ?? {};
        const meta = notifMeta(type, payload);
        const id = crypto.randomUUID();
        setToasts((t) => [
          ...t,
          { id, type, title: meta.title, body: meta.body, link: raw.link },
        ]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);

        // Add to panel list optimistically
        setNotifs((ns) => [
          {
            id: raw.notificationId!,
            type,
            payload,
            link: raw.link,
            isRead: false,
            createdAt: new Date().toISOString(),
          },
          ...ns,
        ]);
      }
    });

    return () => es.close();
  }, [router, active]);

  // Load on mount (to populate badge count) and whenever panel opens
  useEffect(() => {
    if (active) loadNotifs();
  }, [active]);

  useEffect(() => {
    if (panelOpen) loadNotifs();
  }, [panelOpen]);

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(t) &&
        buttonRef.current && !buttonRef.current.contains(t)
      ) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [panelOpen]);

  function dismissToast(id: string) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  function handleBellClick() {
    if (!panelOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const panelWidth = vw >= 640 ? 384 : 320; // sm:w-96 / w-80
      const maxH = Math.floor(vh * 0.7);

      // Horizontal: align panel's right edge to button's right, clamp to viewport
      const preferredLeft = rect.right - panelWidth;
      const left = Math.max(8, Math.min(preferredLeft, vw - panelWidth - 8));

      // Vertical: open downward if ≥200px below button, otherwise open upward
      const style: React.CSSProperties = { left, maxHeight: maxH };
      if (vh - rect.bottom - 8 >= 200) {
        style.top = rect.bottom + 8;
      } else {
        style.bottom = vh - rect.top + 8;
      }
      setPanelStyle(style);
    }
    setPanelOpen((v) => !v);
  }

  return (
    <>
      {/* ── Bell button ── */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleBellClick}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200"
          title="Уведомления"
          aria-label={unread > 0 ? `Уведомления, непрочитанных: ${unread}` : "Уведомления"}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

      </div>

      {/* ── Notification panel (portaled to body, fixed to viewport) ── */}
      {mounted &&
        active &&
        createPortal(
          <AnimatePresence>
            {panelOpen && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.96, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -6 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="glass-strong fixed z-[200] flex w-80 flex-col rounded-2xl shadow-2xl sm:w-96"
              style={panelStyle}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <span className="font-semibold text-neutral-100">Уведомления</span>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      onClick={() => markRead()}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-sky-400 transition hover:bg-white/5"
                      title="Отметить все как прочитанные"
                    >
                      <Check className="h-3 w-3" />
                      Прочитать все
                    </button>
                  )}
                  {notifs.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="rounded-lg p-1 text-neutral-500 transition hover:bg-white/5 hover:text-red-400"
                      title="Удалить все уведомления"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setPanelOpen(false)}
                    aria-label="Закрыть"
                    className="rounded-lg p-1 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="space-y-2 p-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex items-start gap-3">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-1/2" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifs.length === 0 ? (
                  <p className="py-10 text-center text-sm text-neutral-500">Нет уведомлений</p>
                ) : (
                  notifs.map((n) => {
                    const meta = notifMeta(n.type, n.payload);
                    const Icon = meta.icon;
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          markRead(n.id);
                          setPanelOpen(false);
                          if (n.link) router.push(n.link);
                        }}
                        className={`flex w-full items-start gap-3 border-b border-white/[0.05] px-4 py-3 text-left transition hover:bg-white/[0.04] ${
                          !n.isRead ? "bg-sky-500/[0.06]" : ""
                        }`}
                      >
                        <span className={`mt-0.5 shrink-0 ${meta.color}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-neutral-100">
                            {meta.title}
                          </p>
                          <p className="line-clamp-2 text-xs text-neutral-400">{meta.body}</p>
                          {!!(n.payload.boardTitle || n.payload.channelId) && (
                            <p className="mt-0.5 truncate text-[11px] text-neutral-600">
                              {n.payload.boardTitle
                                ? `Доска: ${n.payload.boardTitle as string}`
                                : "В чате"}
                            </p>
                          )}
                          <p className="mt-0.5 text-[10px] text-neutral-600">
                            {formatRelative(n.createdAt)}
                          </p>
                        </div>
                        {!n.isRead && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* ── Toasts (portaled to body for correct stacking) ── */}
      {mounted &&
        active &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-[calc(100vw-2rem)] flex-col-reverse gap-2 sm:bottom-6 sm:right-6 sm:w-80">
            <AnimatePresence>
          {toasts.map((t) => {
            const meta = notifMeta(t.type, {});
            const Icon = t.type === "message"
              ? (t.title.startsWith("#") ? Hash : MessageCircle)
              : meta.icon;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: "spring", stiffness: 360, damping: 30 }}
                className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-neutral-700 bg-neutral-900/95 p-3 shadow-2xl backdrop-blur"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 ${meta.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <button
                  onClick={() => {
                    dismissToast(t.id);
                    if (t.link) router.push(t.link);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-semibold text-neutral-100">{t.title}</p>
                  <p className="line-clamp-2 text-xs text-neutral-400">{t.body}</p>
                </button>
                <button
                  onClick={() => dismissToast(t.id)}
                  aria-label="Закрыть уведомление"
                  className="rounded p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </>
  );
}
