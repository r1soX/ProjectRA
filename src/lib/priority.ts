export type Priority = "LOW" | "MEDIUM" | "URGENT";

export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "URGENT"];

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
  LOW: {
    label: "Низкая",
    badge: "bg-emerald-500/15 text-emerald-300",
    dot: "bg-emerald-400",
    bar: "#10b981",
  },
  MEDIUM: {
    label: "Средняя",
    badge: "bg-amber-500/15 text-amber-300",
    dot: "bg-amber-400",
    bar: "#f59e0b",
  },
  URGENT: {
    label: "Срочная",
    badge: "bg-red-500/20 text-red-300",
    dot: "bg-red-400",
    bar: "#ef4444",
  },
};

export function normalizePriority(value: unknown): Priority {
  return value === "LOW" || value === "URGENT" ? value : "MEDIUM";
}
