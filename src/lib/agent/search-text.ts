export function normalizeAgentSearchText(value: string) {
  return value
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function agentTextIncludes(value: string, query?: string) {
  const normalizedQuery = normalizeAgentSearchText(query ?? "");
  if (!normalizedQuery) return true;

  const normalizedValue = normalizeAgentSearchText(value);
  if (normalizedValue.includes(normalizedQuery)) return true;

  const ignoredWords = new Set(["без", "для", "до", "из", "или", "на", "от", "по", "при"]);
  const significantWords = normalizedQuery
    .split(" ")
    .filter((word) => word.length > 1 && !ignoredWords.has(word));
  return significantWords.length > 0
    && significantWords.every((word) => normalizedValue.includes(word));
}
