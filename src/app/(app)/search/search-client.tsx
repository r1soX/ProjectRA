"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, SearchX, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { PRIORITY_META, normalizePriority } from "@/lib/priority";
import type { TaskHit, BoardHit } from "@/lib/search";

export function SearchClient({
  query,
  tasks,
  boards,
}: {
  query: string;
  tasks: TaskHit[];
  boards: BoardHit[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(query);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  const nothing =
    query.trim().length >= 2 && tasks.length === 0 && boards.length === 0;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-neutral-100">Поиск</h1>

      <form onSubmit={submit} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Поиск задач и досок…"
            autoFocus
            className="pl-9"
          />
        </div>
        <Button type="submit">Найти</Button>
      </form>

      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="text-sm text-neutral-500">Введите минимум 2 символа.</p>
      )}

      {boards.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Доски
          </h2>
          <div className="space-y-1.5">
            {boards.map((b) => (
              <Link
                key={b.id}
                href={`/boards/${b.id}`}
                className="flex items-center gap-3 rounded-lg glass glass-hover p-3 transition hover:border-neutral-700 hover:bg-neutral-900/70"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: b.color }}
                >
                  <LayoutGrid className="h-4 w-4" />
                </span>
                <span className="text-sm text-neutral-100">{b.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tasks.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Задачи ({tasks.length})
          </h2>
          <div className="space-y-1.5">
            {tasks.map((t) => {
              const pr = PRIORITY_META[normalizePriority(t.priority)];
              return (
                <Link
                  key={t.id}
                  href={`/boards/${t.boardId}?task=${t.id}`}
                  className="flex items-center gap-3 rounded-lg glass glass-hover p-3 transition hover:border-neutral-700 hover:bg-neutral-900/70"
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", pr.dot)} />
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">
                    {t.title}
                  </span>
                  <span
                    className="shrink-0 rounded px-2 py-0.5 text-xs text-neutral-300"
                    style={{ backgroundColor: t.boardColor + "22" }}
                  >
                    {t.boardTitle}
                  </span>
                  <span className="hidden shrink-0 text-xs text-neutral-500 sm:inline">
                    {t.columnTitle}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {nothing && (
        <EmptyState
          icon={SearchX}
          title="Ничего не найдено"
          description={`По запросу «${query}» ничего нет. Попробуйте другие слова или проверьте опечатки.`}
        />
      )}

      {query.trim().length === 0 && (
        <EmptyState
          icon={SearchIcon}
          title="Найдите что угодно"
          description="Ищите задачи и доски по названию — результаты появятся здесь."
        />
      )}
    </div>
  );
}
