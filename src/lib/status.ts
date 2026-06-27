export type TaskStatus = "backlog" | "todo" | "in_progress" | "done" | "canceled";

export const STATUSES: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "canceled",
];

export const STATUS_META: Record<
  TaskStatus,
  { label: string; dot: string; badge: string }
> = {
  backlog: {
    label: "Бэклог",
    dot: "bg-neutral-500",
    badge: "bg-neutral-700/60 text-neutral-300",
  },
  todo: {
    label: "К работе",
    dot: "bg-sky-400",
    badge: "bg-sky-500/15 text-sky-300",
  },
  in_progress: {
    label: "В работе",
    dot: "bg-amber-400",
    badge: "bg-amber-500/15 text-amber-300",
  },
  done: {
    label: "Готово",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300",
  },
  canceled: {
    label: "Отменено",
    dot: "bg-neutral-600",
    badge: "bg-neutral-800 text-neutral-500",
  },
};

export function normalizeStatus(value: unknown): TaskStatus {
  return STATUSES.includes(value as TaskStatus) ? (value as TaskStatus) : "todo";
}
