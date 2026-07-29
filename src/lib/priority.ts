export type Priority = "NOT_URGENT" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// Ascending urgency — used for the picker order and for sorting.
export const PRIORITIES: Priority[] = [
  "NOT_URGENT",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

/** Higher rank = more urgent (for "sort by priority" — critical first). */
export const PRIORITY_RANK: Record<Priority, number> = {
  NOT_URGENT: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const PRIORITY_META: Record<
  Priority,
  {
    label: string;
    // Tailwind classes for the badge on a card
    badge: string;
    // dot/accent color
    dot: string;
    // left accent bar color
    bar: string;
  }
> = {
  NOT_URGENT: {
    label: "Не срочный",
    badge: "bg-slate-500/15 text-slate-300",
    dot: "bg-slate-400",
    bar: "#94a3b8",
  },
  LOW: {
    label: "Низкий",
    badge: "bg-emerald-500/15 text-emerald-300",
    dot: "bg-emerald-400",
    bar: "#10b981",
  },
  MEDIUM: {
    label: "Средний",
    badge: "bg-amber-500/15 text-amber-300",
    dot: "bg-amber-400",
    bar: "#f59e0b",
  },
  HIGH: {
    label: "Высокий",
    badge: "bg-orange-500/15 text-orange-300",
    dot: "bg-orange-400",
    bar: "#f97316",
  },
  CRITICAL: {
    label: "Критичный",
    badge: "bg-red-500/20 text-red-300",
    dot: "bg-red-400",
    bar: "#ef4444",
  },
};

export function normalizePriority(value: unknown): Priority {
  if (
    value === "NOT_URGENT" ||
    value === "LOW" ||
    value === "MEDIUM" ||
    value === "HIGH" ||
    value === "CRITICAL"
  ) {
    return value;
  }
  // Legacy 3-level scale → 5-level.
  if (value === "URGENT") return "HIGH";
  return "MEDIUM";
}
