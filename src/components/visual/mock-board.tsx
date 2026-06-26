"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

type MockCard = {
  title: string;
  label: string;
  labelColor: string;
  people: number;
  done?: boolean;
};

const columns: { title: string; accent: string; cards: MockCard[] }[] = [
  {
    title: "К работе",
    accent: "bg-sky-400",
    cards: [
      { title: "Дизайн главного экрана", label: "UI", labelColor: "bg-sky-500/20 text-sky-300", people: 2 },
      { title: "Сбор требований", label: "Анализ", labelColor: "bg-violet-500/20 text-violet-300", people: 1 },
    ],
  },
  {
    title: "В процессе",
    accent: "bg-amber-400",
    cards: [
      { title: "API авторизации", label: "Backend", labelColor: "bg-emerald-500/20 text-emerald-300", people: 3 },
      { title: "Перетягивание задач", label: "Frontend", labelColor: "bg-pink-500/20 text-pink-300", people: 2 },
    ],
  },
  {
    title: "Готово",
    accent: "bg-emerald-400",
    cards: [
      { title: "Настройка проекта", label: "DevOps", labelColor: "bg-orange-500/20 text-orange-300", people: 1, done: true },
    ],
  },
];

const avatarColors = [
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-fuchsia-500 to-pink-500",
];

export function MockBoard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-neutral-900/70 p-3 shadow-2xl backdrop-blur-xl sm:p-4",
        className,
      )}
    >
      {/* Window chrome */}
      <div className="mb-3 flex items-center gap-1.5 px-1">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 text-xs text-neutral-500">Доска · Запуск продукта</span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {columns.map((col, ci) => (
          <div key={col.title} className="min-w-0">
            <div className="mb-2 flex items-center gap-1.5 px-0.5">
              <span className={cn("h-2 w-2 rounded-full", col.accent)} />
              <span className="truncate text-[11px] font-medium text-neutral-400 sm:text-xs">
                {col.title}
              </span>
            </div>
            <div className="space-y-2">
              {col.cards.map((card, idx) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.45,
                    delay: 0.15 * ci + 0.1 * idx,
                    ease: "easeOut",
                  }}
                  className="rounded-lg border border-white/10 bg-neutral-800/80 p-2.5 sm:p-3"
                >
                  <span
                    className={cn(
                      "inline-block rounded px-1.5 py-0.5 text-[9px] font-medium sm:text-[10px]",
                      card.labelColor,
                    )}
                  >
                    {card.label}
                  </span>
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-neutral-200 sm:text-xs">
                    {card.title}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex -space-x-1.5">
                      {Array.from({ length: card.people }).map((_, p) => (
                        <span
                          key={p}
                          className={cn(
                            "h-4 w-4 rounded-full border border-neutral-800 bg-gradient-to-br sm:h-5 sm:w-5",
                            avatarColors[p % avatarColors.length],
                          )}
                        />
                      ))}
                    </div>
                    {card.done && (
                      <span className="text-[10px] text-emerald-400">✓</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
