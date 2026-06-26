export type RecurFreq = "DAILY" | "WEEKLY" | "MONTHLY";

export type RecurRule = {
  freq: RecurFreq;
  interval: number; // for DAILY: every N days
  days: number[]; // WEEKLY: 1-7 (Mon-Sun); MONTHLY: 1-31
  until: string | null; // yyyy-mm-dd
};

export const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function isoWeekday(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1; // 1 = Mon … 7 = Sun
}

export function parseRecurDays(json: string | null): number[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

/** Build a rule object from task fields, or null if not recurring. */
export function ruleFromTask(t: {
  recurFreq: string | null;
  recurInterval: number;
  recurDays: string | null;
  recurUntil: string | null;
}): RecurRule | null {
  if (t.recurFreq !== "DAILY" && t.recurFreq !== "WEEKLY" && t.recurFreq !== "MONTHLY")
    return null;
  return {
    freq: t.recurFreq,
    interval: t.recurInterval || 1,
    days: parseRecurDays(t.recurDays),
    until: t.recurUntil,
  };
}

/** Human-readable description, e.g. «каждый день», «1, 15 числа месяца». */
export function describeRecurrence(rule: RecurRule): string {
  if (rule.freq === "DAILY") {
    return rule.interval <= 1 ? "каждый день" : `каждые ${rule.interval} дн.`;
  }
  if (rule.freq === "WEEKLY") {
    if (rule.days.length === 0) return "каждую неделю";
    const labels = [...rule.days]
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_LABELS[d - 1])
      .join(", ");
    return `еженедельно: ${labels}`;
  }
  // MONTHLY
  if (rule.days.length === 0) return "каждый месяц";
  const nums = [...rule.days].sort((a, b) => a - b).join(", ");
  return `${nums} числа каждого месяца`;
}

function utcWeekday(d: Date): number {
  return ((d.getUTCDay() + 6) % 7) + 1; // 1 = Mon … 7 = Sun
}

/**
 * Next occurrence strictly after `from`, or null if past `until`.
 * Works entirely in UTC so the resulting calendar date (yyyy-mm-dd via
 * toISOString) matches how the rest of the app stores/shows dates.
 */
export function nextOccurrence(rule: RecurRule, from: Date): Date | null {
  const start = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const until = rule.until ? new Date(rule.until + "T00:00:00Z") : null;

  for (let i = 1; i <= 400; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    let ok = false;
    if (rule.freq === "DAILY") {
      ok = i % Math.max(1, rule.interval) === 0;
    } else if (rule.freq === "WEEKLY") {
      ok =
        rule.days.length === 0
          ? utcWeekday(d) === utcWeekday(start)
          : rule.days.includes(utcWeekday(d));
    } else {
      ok =
        rule.days.length === 0
          ? d.getUTCDate() === start.getUTCDate()
          : rule.days.includes(d.getUTCDate());
    }
    if (ok) {
      if (until && d > until) return null;
      return d;
    }
  }
  return null;
}
