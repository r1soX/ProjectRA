/**
 * Timezones.
 *
 * A task's due date is stored as a wall-clock time encoded in UTC parts (e.g.
 * "11:00" is stored as 11:00Z). We define that canonical wall-clock to be in
 * the DEFAULT timezone (Иркутск). So:
 *   • a setter enters a time in THEIR timezone → we shift it to the canonical
 *     Иркутск wall-clock before storing;
 *   • a viewer sees the canonical wall-clock shifted into THEIR timezone.
 *
 * Because the default is Иркутск (delta 0), users on the default zone are
 * completely unaffected and no stored data needs migrating — only users on a
 * different zone see a shifted time.
 *
 * Russia observes no DST, so every zone is a fixed UTC offset (minutes east).
 */
export const DEFAULT_TZ = "Asia/Irkutsk";
export const DEFAULT_OFFSET = 480; // Иркутск = UTC+8

export const TIMEZONES: { id: string; label: string; offset: number }[] = [
  { id: "Europe/Kaliningrad", label: "Калининград (UTC+2)", offset: 120 },
  { id: "Europe/Moscow", label: "Москва (UTC+3)", offset: 180 },
  { id: "Europe/Samara", label: "Самара (UTC+4)", offset: 240 },
  { id: "Asia/Yekaterinburg", label: "Екатеринбург (UTC+5)", offset: 300 },
  { id: "Asia/Omsk", label: "Омск (UTC+6)", offset: 360 },
  { id: "Asia/Krasnoyarsk", label: "Красноярск (UTC+7)", offset: 420 },
  { id: "Asia/Irkutsk", label: "Иркутск (UTC+8)", offset: 480 },
  { id: "Asia/Yakutsk", label: "Якутск (UTC+9)", offset: 540 },
  { id: "Asia/Vladivostok", label: "Владивосток (UTC+10)", offset: 600 },
  { id: "Asia/Magadan", label: "Магадан (UTC+11)", offset: 660 },
  { id: "Asia/Kamchatka", label: "Камчатка (UTC+12)", offset: 720 },
];

const OFFSETS = new Map(TIMEZONES.map((t) => [t.id, t.offset]));

export function offsetOf(tz: string | null | undefined): number {
  if (!tz) return DEFAULT_OFFSET;
  return OFFSETS.get(tz) ?? DEFAULT_OFFSET;
}

export function isValidTz(tz: string): boolean {
  return OFFSETS.has(tz);
}

/** A stored due date carries a time only if it isn't at (UTC) midnight. */
function hasTime(d: Date): boolean {
  return (
    d.getUTCHours() !== 0 ||
    d.getUTCMinutes() !== 0 ||
    d.getUTCSeconds() !== 0
  );
}

/**
 * Stored canonical (Иркутск) wall-clock → the viewer's wall-clock, for display.
 * Date-only values (no time) represent a calendar day and are never shifted.
 */
export function toViewerWall(d: Date | null, viewerTz: string): Date | null {
  if (!d || !hasTime(d)) return d;
  return new Date(d.getTime() + (offsetOf(viewerTz) - DEFAULT_OFFSET) * 60000);
}

/**
 * A wall-clock entered in the setter's timezone → canonical (Иркутск)
 * wall-clock, for storage. Date-only values are stored as-is.
 */
export function toCanonicalWall(d: Date | null, setterTz: string): Date | null {
  if (!d || !hasTime(d)) return d;
  return new Date(d.getTime() + (DEFAULT_OFFSET - offsetOf(setterTz)) * 60000);
}
