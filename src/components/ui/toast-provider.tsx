"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastType = "success" | "error" | "info";
type ToastAction = { label: string; onClick: () => void };
type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
};
type ToastInput = {
  type?: ToastType;
  message: string;
  action?: ToastAction;
  duration?: number;
};

const ToastCtx = createContext<(input: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

const META: Record<ToastType, { icon: React.ElementType; color: string }> = {
  success: { icon: CheckCircle2, color: "text-emerald-400" },
  error: { icon: AlertCircle, color: "text-red-400" },
  info: { icon: Info, color: "text-sky-400" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((ts) => [
        ...ts,
        { id, type: input.type ?? "info", message: input.message, action: input.action },
      ]);
      const tm = setTimeout(() => dismiss(id), input.duration ?? 4000);
      timers.current.set(id, tm);
    },
    [dismiss],
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {mounted &&
        createPortal(
          <MotionConfig reducedMotion="user">
            <div className="pointer-events-none fixed bottom-4 left-1/2 z-[320] flex w-[min(92vw,28rem)] -translate-x-1/2 flex-col-reverse gap-2">
              <AnimatePresence>
                {toasts.map((t) => {
                  const { icon: Icon, color } = META[t.type];
                  return (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: 16, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 360, damping: 30 }}
                      className="pointer-events-auto flex items-center gap-3 rounded-xl border border-neutral-700 bg-neutral-900/95 px-4 py-3 shadow-2xl backdrop-blur"
                    >
                      <Icon className={cn("h-5 w-5 shrink-0", color)} />
                      <span className="min-w-0 flex-1 text-sm text-neutral-100">
                        {t.message}
                      </span>
                      {t.action && (
                        <button
                          type="button"
                          onClick={() => {
                            t.action!.onClick();
                            dismiss(t.id);
                          }}
                          className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-sky-400 transition hover:bg-white/5"
                        >
                          {t.action.label}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => dismiss(t.id)}
                        aria-label="Закрыть"
                        className="shrink-0 rounded p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </MotionConfig>,
          document.body,
        )}
    </ToastCtx.Provider>
  );
}
