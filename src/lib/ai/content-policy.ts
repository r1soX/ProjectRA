const TECHNICAL_ID_PATTERN = /\b(?:c[a-z0-9]{20,31}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/i;

export function containsTechnicalId(value: string | null | undefined) {
  return Boolean(value && TECHNICAL_ID_PATTERN.test(value));
}
