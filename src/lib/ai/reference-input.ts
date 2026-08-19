export type AiReferenceTrigger = {
  type: "user" | "project" | "task";
  start: number;
  query: string;
};

export function detectAiReferenceTrigger(
  value: string,
  cursor: number,
  selectedMarkers: string[],
): AiReferenceTrigger | null {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(^|[\s(])([@#$])([^@#$\n]*)$/);
  if (!match || match[3].length > 120) return null;

  const symbol = match[2];
  const start = beforeCursor.lastIndexOf(symbol);
  const isCompletedReference = selectedMarkers.some((marker) => (
    beforeCursor.startsWith(marker, start)
    && /\s/.test(beforeCursor.charAt(start + marker.length))
  ));
  if (isCompletedReference) return null;

  return {
    type: symbol === "@" ? "user" : symbol === "#" ? "project" : "task",
    start,
    query: match[3].trim(),
  };
}
