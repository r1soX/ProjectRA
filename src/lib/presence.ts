export const ONLINE_WINDOW_MS = 70_000; // считаем онлайн, если был в сети < 70 сек назад

export function isOnline(lastSeenAt: string | Date | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

/** «в сети» / «был(а) в сети N мин назад» */
export function formatLastSeen(
  lastSeenAt: string | Date | null | undefined,
  female = false,
): string {
  if (!lastSeenAt) return "не в сети";
  if (isOnline(lastSeenAt)) return "в сети";
  const d = new Date(lastSeenAt);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  const was = female ? "была" : "был";
  if (diffMin < 1) return `${was} в сети только что`;
  if (diffMin < 60) return `${was} в сети ${diffMin} мин назад`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${was} в сети ${hours} ч назад`;
  return `${was} в сети ${d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
  })}`;
}
