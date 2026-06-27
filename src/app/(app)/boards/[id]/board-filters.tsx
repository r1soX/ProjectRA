"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Filter,
  User as UserIcon,
  Tag,
  Flag,
  CalendarClock,
  Bookmark,
  X,
  Check,
  Search,
  ChevronDown,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { usePrompt, useConfirm } from "@/components/ui/dialog-provider";
import { PRIORITIES, PRIORITY_META } from "@/lib/priority";
import { cn } from "@/lib/cn";
import type { BoardMemberView, BoardLabel } from "./board-view";

export type DueFilter = "any" | "overdue" | "today" | "week" | "none";
export type BoardFilterState = {
  mine: boolean;
  assignees: string[];
  labels: string[];
  priorities: string[];
  due: DueFilter;
  text: string;
};
export type SavedView = { name: string; filters: BoardFilterState };

export const EMPTY_FILTERS: BoardFilterState = {
  mine: false,
  assignees: [],
  labels: [],
  priorities: [],
  due: "any",
  text: "",
};

export function isFilterActive(f: BoardFilterState): boolean {
  return (
    f.mine ||
    f.assignees.length > 0 ||
    f.labels.length > 0 ||
    f.priorities.length > 0 ||
    f.due !== "any" ||
    f.text.trim().length > 0
  );
}

const DUE_LABELS: Record<DueFilter, string> = {
  any: "Срок",
  overdue: "Просрочено",
  today: "Сегодня",
  week: "На неделе",
  none: "Без срока",
};

function Dropdown({
  label,
  icon: Icon,
  active,
  children,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition",
          active
            ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
            : "border-neutral-700 bg-neutral-800/60 text-neutral-300 hover:bg-neutral-800",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="absolute left-0 z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-800 p-1 shadow-2xl"
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckRow({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-200 hover:bg-white/5"
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          active ? "border-sky-500 bg-sky-500/30 text-sky-300" : "border-neutral-600",
        )}
      >
        {active && <Check className="h-3 w-3" />}
      </span>
      {children}
    </button>
  );
}

export function BoardFilters({
  filters,
  onChange,
  members,
  labels,
  views,
  onSaveView,
  onApplyView,
  onDeleteView,
}: {
  filters: BoardFilterState;
  onChange: (f: BoardFilterState) => void;
  members: BoardMemberView[];
  labels: BoardLabel[];
  views: SavedView[];
  onSaveView: (name: string) => void;
  onApplyView: (v: SavedView) => void;
  onDeleteView: (name: string) => void;
}) {
  const prompt = usePrompt();
  const confirm = useConfirm();
  const active = isFilterActive(filters);

  const toggleIn = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5 sm:px-6">
      <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        <Filter className="h-3.5 w-3.5" />
      </span>

      {/* Mine */}
      <button
        type="button"
        onClick={() => onChange({ ...filters, mine: !filters.mine })}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition",
          filters.mine
            ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
            : "border-neutral-700 bg-neutral-800/60 text-neutral-300 hover:bg-neutral-800",
        )}
      >
        <UserIcon className="h-3.5 w-3.5" />
        Мои
      </button>

      {/* Assignees */}
      {members.length > 0 && (
        <Dropdown
          label={filters.assignees.length ? `Исполнитель · ${filters.assignees.length}` : "Исполнитель"}
          icon={UserIcon}
          active={filters.assignees.length > 0}
        >
          {() =>
            members.map((m) => (
              <CheckRow
                key={m.userId}
                active={filters.assignees.includes(m.userId)}
                onClick={() => onChange({ ...filters, assignees: toggleIn(filters.assignees, m.userId) })}
              >
                <Avatar image={m.avatar} emoji={m.emoji} initials={m.initials} size={20} />
                <span className="truncate">{m.shortName}</span>
              </CheckRow>
            ))
          }
        </Dropdown>
      )}

      {/* Labels */}
      {labels.length > 0 && (
        <Dropdown
          label={filters.labels.length ? `Метки · ${filters.labels.length}` : "Метки"}
          icon={Tag}
          active={filters.labels.length > 0}
        >
          {() =>
            labels.map((l) => (
              <CheckRow
                key={l.id}
                active={filters.labels.includes(l.id)}
                onClick={() => onChange({ ...filters, labels: toggleIn(filters.labels, l.id) })}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="truncate">{l.name}</span>
              </CheckRow>
            ))
          }
        </Dropdown>
      )}

      {/* Priority */}
      <Dropdown
        label={filters.priorities.length ? `Приоритет · ${filters.priorities.length}` : "Приоритет"}
        icon={Flag}
        active={filters.priorities.length > 0}
      >
        {() =>
          PRIORITIES.map((p) => (
            <CheckRow
              key={p}
              active={filters.priorities.includes(p)}
              onClick={() => onChange({ ...filters, priorities: toggleIn(filters.priorities, p) })}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_META[p].dot)} />
              <span>{PRIORITY_META[p].label}</span>
            </CheckRow>
          ))
        }
      </Dropdown>

      {/* Due */}
      <Dropdown label={DUE_LABELS[filters.due]} icon={CalendarClock} active={filters.due !== "any"}>
        {(close) =>
          (["any", "overdue", "today", "week", "none"] as DueFilter[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                onChange({ ...filters, due: d });
                close();
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5",
                filters.due === d ? "text-sky-300" : "text-neutral-200",
              )}
            >
              {DUE_LABELS[d]}
              {filters.due === d && <Check className="h-3.5 w-3.5" />}
            </button>
          ))
        }
      </Dropdown>

      {/* Text */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
        <input
          value={filters.text}
          onChange={(e) => onChange({ ...filters, text: e.target.value })}
          placeholder="Поиск на доске…"
          className="h-8 w-40 rounded-lg border border-neutral-700 bg-neutral-800/60 pl-8 pr-2 text-xs text-neutral-100 outline-none focus:border-sky-500"
        />
      </div>

      {/* Saved views */}
      <Dropdown label="Виды" icon={Bookmark} active={false}>
        {(close) => (
          <div>
            {views.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-neutral-600">Сохранённых видов нет.</p>
            )}
            {views.map((v) => (
              <div key={v.name} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onApplyView(v);
                    close();
                  }}
                  className="flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm text-neutral-200 hover:bg-white/5"
                >
                  {v.name}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Удалить вид?",
                      message: `«${v.name}» будет удалён.`,
                      confirmLabel: "Удалить",
                      danger: true,
                    });
                    if (ok) onDeleteView(v.name);
                  }}
                  aria-label="Удалить вид"
                  className="hidden rounded p-1 text-neutral-600 hover:text-red-400 group-hover:block"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {active && (
              <button
                type="button"
                onClick={async () => {
                  close();
                  const name = await prompt({
                    title: "Сохранить вид",
                    label: "Название",
                    placeholder: "Например, Срочные мои",
                    confirmLabel: "Сохранить",
                  });
                  if (name) onSaveView(name);
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-white/5 px-2 py-1.5 text-left text-sm text-sky-400 hover:bg-white/5"
              >
                <Bookmark className="h-3.5 w-3.5" />
                Сохранить текущий…
              </button>
            )}
          </div>
        )}
      </Dropdown>

      {active && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200"
        >
          <X className="h-3.5 w-3.5" />
          Сбросить
        </button>
      )}
    </div>
  );
}
