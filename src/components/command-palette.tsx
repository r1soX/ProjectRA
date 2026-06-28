"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Plus,
  LayoutDashboard,
  LayoutGrid,
  CalendarDays,
  MessageCircle,
  User as UserIcon,
  BarChart2,
  CornerDownLeft,
  ArrowLeft,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/cn";
import { openDm } from "@/app/(app)/messages/actions";
import { quickCreateTask } from "@/app/(app)/boards/actions";
import type { NavCaps } from "@/components/app-shell";

type BoardHit = { id: string; title: string; color: string };
type TaskHit = {
  id: string;
  title: string;
  boardId: string;
  boardTitle: string;
  boardColor: string;
};
type PersonHit = {
  id: string;
  fullName: string;
  username: string;
  initials: string;
  avatar: string | null;
  emoji: string | null;
};

type NavEntry = { href: string; label: string; icon: React.ElementType };

type Item =
  | { kind: "quickadd"; label: string }
  | ({ kind: "nav" } & NavEntry)
  | { kind: "board"; board: BoardHit }
  | { kind: "task"; task: TaskHit }
  | { kind: "person"; person: PersonHit };

export function CommandPalette({ caps }: { caps: NavCaps }) {
  const router = useRouter();
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ boards: BoardHit[]; tasks: TaskHit[]; users: PersonHit[] }>({
    boards: [],
    tasks: [],
    users: [],
  });
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<"search" | "quickadd">("search");
  const [qaTitle, setQaTitle] = useState("");
  const [qaBoard, setQaBoard] = useState("");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Open via ⌘K / Ctrl+K, or a custom event (sidebar button).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("projectra:command", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("projectra:command", onOpenEvent);
    };
  }, []);

  // Reset when opening / closing.
  useEffect(() => {
    if (open) {
      setQ("");
      setMode("search");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced fetch.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/command?q=${encodeURIComponent(q)}`);
        if (res.ok) setData(await res.json());
      } catch {
        /* ignore */
      }
    }, 160);
    return () => clearTimeout(id);
  }, [q, open]);

  const navEntries = useMemo<NavEntry[]>(() => {
    const all: (NavEntry & { cap?: keyof NavCaps })[] = [
      { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
      { href: "/boards", label: "Доски", icon: LayoutGrid, cap: "boards" },
      { href: "/calendar", label: "Календарь", icon: CalendarDays, cap: "tasks" },
      { href: "/workload", label: "Нагрузка", icon: BarChart2, cap: "tasks" },
      { href: "/messages", label: "Сообщения", icon: MessageCircle, cap: "messages" },
      { href: "/profile", label: "Профиль", icon: UserIcon },
    ];
    return all.filter((n) => !n.cap || caps[n.cap]);
  }, [caps]);

  const items = useMemo<Item[]>(() => {
    const ql = q.trim().toLowerCase();
    const list: Item[] = [];
    if (caps.boards && data.boards.length > 0) {
      list.push({ kind: "quickadd", label: "Создать задачу" });
    }
    for (const n of navEntries) {
      if (!ql || n.label.toLowerCase().includes(ql)) list.push({ kind: "nav", ...n });
    }
    for (const b of data.boards) list.push({ kind: "board", board: b });
    for (const t of data.tasks) list.push({ kind: "task", task: t });
    for (const u of data.users) list.push({ kind: "person", person: u });
    return list;
  }, [q, navEntries, data, caps.boards]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, items.length - 1)));
  }, [items.length]);

  function close() {
    setOpen(false);
  }

  function activate(item: Item) {
    switch (item.kind) {
      case "quickadd":
        setMode("quickadd");
        setQaBoard(data.boards[0]?.id ?? "");
        setQaTitle(q.trim());
        setTimeout(() => inputRef.current?.focus(), 30);
        return;
      case "nav":
        router.push(item.href);
        break;
      case "board":
        router.push(`/boards/${item.board.id}`);
        break;
      case "task":
        router.push(`/boards/${item.task.boardId}?task=${item.task.id}`);
        break;
      case "person":
        start(() => openDm(item.person.id));
        break;
    }
    close();
  }

  function submitQuickAdd() {
    const title = qaTitle.trim();
    if (!title || !qaBoard) return;
    start(async () => {
      const r = await quickCreateTask(qaBoard, title);
      close();
      if (r) {
        toast({ type: "success", message: "Задача создана" });
        router.push(`/boards/${qaBoard}?task=${r.taskId}`);
      } else {
        toast({ type: "error", message: "Не удалось создать задачу" });
      }
    });
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (mode === "quickadd") setMode("search");
      else close();
      return;
    }
    if (mode !== "search") {
      if (e.key === "Enter") {
        e.preventDefault();
        submitQuickAdd();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[active];
      if (it) activate(it);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="glass-strong relative z-10 w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl"
          >
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              {mode === "quickadd" ? (
                <button
                  type="button"
                  onClick={() => setMode("search")}
                  aria-label="Назад"
                  className="text-neutral-400 hover:text-neutral-200"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : (
                <Search className="h-5 w-5 text-neutral-500" />
              )}
              <input
                ref={inputRef}
                value={mode === "quickadd" ? qaTitle : q}
                onChange={(e) =>
                  mode === "quickadd" ? setQaTitle(e.target.value) : setQ(e.target.value)
                }
                onKeyDown={onInputKey}
                placeholder={
                  mode === "quickadd" ? "Название задачи…" : "Поиск задач, досок, людей…"
                }
                className="w-full bg-transparent text-base text-neutral-100 outline-none placeholder:text-neutral-600"
              />
              <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-500 sm:block">
                Esc
              </kbd>
            </div>

            {/* Body */}
            {mode === "quickadd" ? (
              <div className="space-y-3 p-4">
                <label className="block text-xs font-medium text-neutral-500">Доска</label>
                <select
                  value={qaBoard}
                  onChange={(e) => setQaBoard(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-sky-500"
                >
                  {data.boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={submitQuickAdd}
                  disabled={pending || !qaTitle.trim() || !qaBoard}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-sky-400 to-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Создать задачу
                </button>
              </div>
            ) : (
              <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
                {items.length === 0 ? (
                  <p className="py-10 text-center text-sm text-neutral-500">
                    Ничего не найдено
                  </p>
                ) : (
                  items.map((it, i) => (
                    <CommandRow
                      key={rowKey(it, i)}
                      item={it}
                      activeRow={i === active}
                      onHover={() => setActive(i)}
                      onClick={() => activate(it)}
                    />
                  ))
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function rowKey(it: Item, i: number) {
  if (it.kind === "board") return "b" + it.board.id;
  if (it.kind === "task") return "t" + it.task.id;
  if (it.kind === "person") return "p" + it.person.id;
  if (it.kind === "nav") return "n" + it.href;
  return "k" + i;
}

function CommandRow({
  item,
  activeRow,
  onHover,
  onClick,
}: {
  item: Item;
  activeRow: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
        activeRow ? "bg-white/10" : "hover:bg-white/5",
      )}
    >
      <RowIcon item={item} />
      <div className="min-w-0 flex-1">
        <RowLabel item={item} />
      </div>
      {activeRow && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-neutral-600" />}
    </button>
  );
}

function RowIcon({ item }: { item: Item }) {
  if (item.kind === "quickadd")
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
        <Plus className="h-4 w-4" />
      </span>
    );
  if (item.kind === "nav") {
    const Icon = item.icon;
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-neutral-300">
        <Icon className="h-4 w-4" />
      </span>
    );
  }
  if (item.kind === "board")
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: item.board.color }}
      >
        <LayoutGrid className="h-4 w-4" />
      </span>
    );
  if (item.kind === "task")
    return (
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: item.task.boardColor }}
      />
    );
  return (
    <Avatar
      image={item.person.avatar}
      emoji={item.person.emoji}
      initials={item.person.initials}
      size={28}
    />
  );
}

function RowLabel({ item }: { item: Item }) {
  if (item.kind === "quickadd")
    return <span className="text-sm text-neutral-100">Создать задачу…</span>;
  if (item.kind === "nav")
    return <span className="text-sm text-neutral-100">{item.label}</span>;
  if (item.kind === "board")
    return <span className="truncate text-sm text-neutral-100">{item.board.title}</span>;
  if (item.kind === "task")
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm text-neutral-100">{item.task.title}</span>
        <span className="shrink-0 text-xs text-neutral-500">· {item.task.boardTitle}</span>
      </span>
    );
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate text-sm text-neutral-100">{item.person.fullName}</span>
      <span className="shrink-0 text-xs text-neutral-500">@{item.person.username}</span>
    </span>
  );
}
