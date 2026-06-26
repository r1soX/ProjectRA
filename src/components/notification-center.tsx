"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, Hash, X } from "lucide-react";

type Toast = {
  id: string;
  channelId: string;
  fromName: string;
  preview: string;
  title: string;
  isBoard: boolean;
};

/** Short pleasant "ding" via Web Audio — no asset needed. */
function playPing() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
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
  } catch {
    /* audio blocked or unavailable */
  }
}

export function NotificationCenter() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    es.addEventListener("message", (e) => {
      let p: Omit<Toast, "id">;
      try {
        p = JSON.parse((e as MessageEvent).data);
      } catch {
        return;
      }

      // Update unread badges everywhere.
      router.refresh();

      // Don't toast/ring a channel the user is already looking at.
      const viewing =
        window.location.pathname.startsWith("/messages") &&
        new URLSearchParams(window.location.search).get("c") === p.channelId;
      if (viewing) return;

      playPing();

      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now() + Math.random());
      setToasts((t) => [...t, { id, ...p }]);
      setTimeout(
        () => setToasts((t) => t.filter((x) => x.id !== id)),
        5000,
      );
    });
    return () => es.close();
  }, [router]);

  function dismiss(id: string) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-neutral-700 bg-neutral-900/95 p-3 shadow-2xl backdrop-blur"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
              {t.isBoard ? (
                <Hash className="h-4 w-4" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
            </span>
            <button
              onClick={() => {
                dismiss(t.id);
                router.push(`/messages?c=${t.channelId}`);
              }}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-semibold text-neutral-100">
                {t.title}
              </p>
              <p className="line-clamp-2 text-xs text-neutral-400">
                {t.isBoard ? `${t.fromName}: ${t.preview}` : t.preview}
              </p>
            </button>
            <button
              onClick={() => dismiss(t.id)}
              className="rounded p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
