const WRITE_VERBS = [
  "создай", "создайте", "создать",
  "добавь", "добавьте", "добавить",
  "измени", "измените", "изменить",
  "обнови", "обновите", "обновить",
  "назначь", "назначьте", "назначить",
  "сними", "снимите", "снять",
  "перемести", "переместите", "переместить",
  "перенеси", "перенесите", "перенести",
  "отметь", "отметьте", "отметить",
  "заверши", "завершите", "завершить",
  "прокомментируй", "прокомментируйте", "прокомментировать",
] as const;

const WRITE_VERB_PATTERN = WRITE_VERBS.join("|");
const WRITE_INTENT = new RegExp(
  `(?:^|[\\s,.;:!?])(?:${WRITE_VERB_PATTERN})(?=$|[\\s,.;:!?])`,
  "iu",
);
const NEGATED_WRITE = new RegExp(
  `(?:не|без просьбы)\\s+(?:${WRITE_VERB_PATTERN})`,
  "iu",
);
const HOW_TO_WRITE = new RegExp(
  `(?:^|[\\s,.;:!?])как\\s+(?:${WRITE_VERB_PATTERN})`,
  "iu",
);

export function hasExplicitWriteIntent(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized || NEGATED_WRITE.test(normalized) || HOW_TO_WRITE.test(normalized)) {
    return false;
  }
  return WRITE_INTENT.test(normalized);
}

export function isRetryRequest(text: string) {
  return /(?:попробуй(?:те)?|повтори(?:те)?|ещ[её]\s+раз|заново|вс[её]-таки|продолжай(?:те)?)/iu
    .test(text.trim());
}

export function claimsCompletedMutation(text: string | null | undefined) {
  const normalized = text?.trim().toLowerCase() ?? "";
  if (!normalized) return false;
  if (
    /(?:не\s+(?:готово|создал|создан|добавил|изменил|обновил|назначил|переместил|перен[её]с|завершил|выполнено)|не удалось|не получилось|изменение не выполнено)/iu
      .test(normalized)
  ) {
    return false;
  }
  return /(?:^|[\s,.;:!?])(?:готово|сделано|выполнено|успешно|создал(?:а)?|создан[аоы]?|добавил(?:а)?|добавлен[аоы]?|изменил(?:а)?|обновил(?:а)?|назначил(?:а)?|переместил(?:а)?|перен[её]с(?:ла)?|завершил(?:а)?)(?=$|[\s,.;:!?])/iu
    .test(normalized);
}
