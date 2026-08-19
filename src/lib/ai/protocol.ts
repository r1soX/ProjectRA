export type AiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string; [key: string]: unknown };
  [key: string]: unknown;
};

export type AiCompletionMessage = {
  content: string | null;
  tool_calls?: AiToolCall[];
  reasoning?: string;
  reasoning_details?: unknown[];
};

/** Preserve OpenRouter's opaque tool metadata and reasoning blocks exactly. */
export function normalizeCompletionMessage(
  payload: unknown,
): AiCompletionMessage | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") {
    return null;
  }
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;

  const row = message as Record<string, unknown>;
  const content = typeof row.content === "string" || row.content === null
    ? row.content
    : null;
  const toolCalls = Array.isArray(row.tool_calls)
    ? row.tool_calls.flatMap((value) => {
        const normalized = normalizeToolCall(value);
        return normalized ? [normalized] : [];
      })
    : undefined;

  return {
    content,
    ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
    ...(typeof row.reasoning === "string" ? { reasoning: row.reasoning } : {}),
    ...(Array.isArray(row.reasoning_details)
      ? { reasoning_details: row.reasoning_details }
      : {}),
  };
}

function normalizeToolCall(value: unknown): AiToolCall | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string"
    || !row.function
    || typeof row.function !== "object"
    || Array.isArray(row.function)
  ) {
    return null;
  }
  const fn = row.function as Record<string, unknown>;
  if (typeof fn.name !== "string" || typeof fn.arguments !== "string") {
    return null;
  }

  return {
    ...row,
    id: row.id,
    type: "function",
    function: { ...fn, name: fn.name, arguments: fn.arguments },
  } as AiToolCall;
}
