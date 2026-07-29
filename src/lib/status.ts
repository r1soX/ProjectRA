export type StatusDef = {
  id?: string;
  key: string;
  label: string;
  color: string; // hex, drives dot/badge/bar
  order?: number;
  isSystem?: boolean;
};

// Built-in defaults — seeded into the StatusDef table on first run, and used
// as the client-side fallback when the live list isn't available.
export const DEFAULT_STATUSES: StatusDef[] = [
  { key: "backlog", label: "Бэклог", color: "#6b7280" },
  { key: "todo", label: "К работе", color: "#38bdf8" },
  { key: "in_progress", label: "В работе", color: "#fbbf24" },
  { key: "review", label: "На проверке", color: "#a78bfa" },
  { key: "blocked", label: "Заблокировано", color: "#f87171" },
  { key: "on_hold", label: "Отложено", color: "#fb923c" },
  { key: "done", label: "Готово", color: "#34d399" },
  { key: "canceled", label: "Отменено", color: "#4b5563" },
];

const DEFAULT_BY_KEY = new Map(DEFAULT_STATUSES.map((s) => [s.key, s]));

/** A status by key from the defaults, or a neutral fallback for unknown keys. */
export function defaultStatusOf(key: string): StatusDef {
  return DEFAULT_BY_KEY.get(key) ?? { key, label: key || "—", color: "#64748b" };
}

/** Any non-empty string is a valid status key; empty/invalid → "todo". */
export function normalizeStatus(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "todo";
}

/** Inline styles derived from a status colour (works with custom colours). */
export function statusDotStyle(color: string) {
  return { backgroundColor: color };
}
export function statusBadgeStyle(color: string) {
  return { backgroundColor: color + "26", color }; // 26 ≈ 15% alpha
}
