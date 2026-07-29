export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "review"
  | "blocked"
  | "on_hold"
  | "done"
  | "canceled";

// Rough workflow order (active states first, off-track/terminal states last).
export const STATUSES: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "blocked",
  "on_hold",
  "done",
  "canceled",
];

export const STATUS_META: Record<
  TaskStatus,
  { label: string; dot: string; badge: string; bar: string }
> = {
  backlog: {
    label: "Бэклог",
    dot: "bg-neutral-500",
    badge: "bg-neutral-700/60 text-neutral-300",
    bar: "#6b7280",
  },
  todo: {
    label: "К работе",
    dot: "bg-sky-400",
    badge: "bg-sky-500/15 text-sky-300",
    bar: "#38bdf8",
  },
  in_progress: {
    label: "В работе",
    dot: "bg-amber-400",
    badge: "bg-amber-500/15 text-amber-300",
    bar: "#fbbf24",
  },
  review: {
    label: "На проверке",
    dot: "bg-violet-400",
    badge: "bg-violet-500/15 text-violet-300",
    bar: "#a78bfa",
  },
  blocked: {
    label: "Заблокировано",
    dot: "bg-red-400",
    badge: "bg-red-500/20 text-red-300",
    bar: "#f87171",
  },
  on_hold: {
    label: "Отложено",
    dot: "bg-orange-400",
    badge: "bg-orange-500/15 text-orange-300",
    bar: "#fb923c",
  },
  done: {
    label: "Готово",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300",
    bar: "#34d399",
  },
  canceled: {
    label: "Отменено",
    dot: "bg-neutral-600",
    badge: "bg-neutral-800 text-neutral-500",
    bar: "#4b5563",
  },
};

export function normalizeStatus(value: unknown): TaskStatus {
  return STATUSES.includes(value as TaskStatus) ? (value as TaskStatus) : "todo";
}
