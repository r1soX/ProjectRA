export function aiComposerHeight(
  scrollHeight: number,
  viewportHeight: number,
  expanded: boolean,
) {
  const minHeight = expanded ? 176 : 32;
  const maxHeight = expanded
    ? Math.max(176, Math.floor(viewportHeight * 0.45))
    : 224;
  return Math.min(maxHeight, Math.max(minHeight, scrollHeight));
}
