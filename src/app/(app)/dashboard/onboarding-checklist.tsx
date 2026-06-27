"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, Circle, X, Plus } from "lucide-react";
import { createStarterBoard } from "@/app/(app)/boards/actions";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/cn";
import type { OnboardingStep } from "@/lib/dashboard";

const KEY = "projectra:onboarding-dismissed";

export function OnboardingChecklist({
  steps,
  ownsBoard,
}: {
  steps: OnboardingStep[];
  ownsBoard: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  if (!mounted || dismissed) return null;

  const done = steps.filter((s) => s.done).length;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function makeBoard() {
    start(async () => {
      const r = await createStarterBoard();
      toast({ type: "success", message: "Демо-доска создана" });
      router.push(`/boards/${r.boardId}`);
    });
  }

  return (
    <div className="glass mb-6 rounded-2xl border border-sky-500/20 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-neutral-100">Быстрый старт</h2>
            <p className="text-xs text-neutral-500">
              {done} из {steps.length} шагов пройдено
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Скрыть"
          className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="my-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            {s.done ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-neutral-600" />
            )}
            <span className={cn(s.done ? "text-neutral-500 line-through" : "text-neutral-200")}>
              {s.label}
            </span>
          </li>
        ))}
      </ul>

      {!ownsBoard && (
        <button
          onClick={makeBoard}
          disabled={pending}
          className="mt-4 flex items-center gap-2 rounded-lg bg-gradient-to-b from-sky-400 to-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {pending ? "Создаю…" : "Создать демо-доску"}
        </button>
      )}
    </div>
  );
}
