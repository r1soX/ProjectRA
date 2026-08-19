import "server-only";

import { fetch as undiciFetch, ProxyAgent } from "undici";

export type AiProviderName = "cerebras" | "gemini" | "groq";

export type AiChatTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type AiChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: AiToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type AiCompletionRequest = {
  messages: AiChatMessage[];
  tools?: AiChatTool[];
  tool_choice?: "auto" | "none";
  parallel_tool_calls?: boolean;
  temperature?: number;
  max_completion_tokens?: number;
};

export type AiCompletionResult = {
  message: { content: string | null; tool_calls?: AiToolCall[] };
  provider: AiProviderName;
  model: string;
};

export type AiAssistantConfig = {
  maxCompletionTokens: number;
  maxToolRounds: number;
  historyMessages: number;
  debug: boolean;
};

type ProviderConfig = {
  name: AiProviderName;
  apiKey: string;
  model: string;
  completionUrl: string;
  proxyUrl: string;
  timeoutMs: number;
};

type CachedAssistant = {
  client: AiCompletionClient;
  config: AiAssistantConfig;
};

export type AiProviderErrorKind =
  | "authentication"
  | "rate_limit"
  | "timeout"
  | "connection"
  | "bad_request"
  | "not_found"
  | "server"
  | "invalid_response";

const PROVIDER_ORDER: AiProviderName[] = ["cerebras", "gemini", "groq"];
const DEFAULT_BASE_URLS: Record<AiProviderName, string> = {
  cerebras: "https://api.cerebras.ai/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  groq: "https://api.groq.com/openai/v1",
};
const DEFAULT_MODELS: Record<AiProviderName, string> = {
  cerebras: "gpt-oss-120b",
  gemini: "gemini-3.7-flash",
  groq: "openai/gpt-oss-120b",
};
let cached: CachedAssistant | null = null;

export class AiConfigurationError extends Error {}

export class AiProviderError extends Error {
  constructor(
    public readonly provider: AiProviderName,
    public readonly kind: AiProviderErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export class AiProvidersExhaustedError extends Error {
  constructor(public readonly attempts: AiProviderError[]) {
    super("Все настроенные провайдеры ИИ недоступны.");
    this.name = "AiProvidersExhaustedError";
  }
}

export function isAiConfigured() {
  return PROVIDER_ORDER.some((name) =>
    Boolean(process.env[`${envPrefix(name)}_API_KEY`]?.trim()),
  );
}

export function getAiHistoryMessageLimit() {
  return integerEnv("PROJECTRA_AI_HISTORY_MESSAGES", 12, 4, 30);
}

export function getAiAssistant(): CachedAssistant {
  if (cached) return cached;

  const providers = providerConfigs();
  if (providers.length === 0) {
    throw new AiConfigurationError(
      "ИИ-помощник не настроен: отсутствуют CEREBRAS_API_KEY, GEMINI_API_KEY и GROQ_API_KEY.",
    );
  }

  const config: AiAssistantConfig = {
    maxCompletionTokens: integerEnv(
      "PROJECTRA_AI_MAX_COMPLETION_TOKENS",
      integerEnv("GROQ_MAX_COMPLETION_TOKENS", 2_048, 256, 16_384),
      256,
      16_384,
    ),
    maxToolRounds: integerEnv(
      "PROJECTRA_AI_MAX_TOOL_ROUNDS",
      integerEnv("GROQ_MAX_TOOL_ROUNDS", 6, 1, 10),
      1,
      10,
    ),
    historyMessages: getAiHistoryMessageLimit(),
    debug: process.env.PROJECTRA_AI_DEBUG?.trim() === "1",
  };

  cached = { client: new AiCompletionClient(providers, config.debug), config };
  return cached;
}

class AiCompletionClient {
  constructor(
    private readonly providers: ProviderConfig[],
    private readonly debug: boolean,
  ) {}

  async create(
    request: AiCompletionRequest,
    signal?: AbortSignal,
  ): Promise<AiCompletionResult> {
    const attempts: AiProviderError[] = [];

    for (const provider of this.providers) {
      try {
        return await requestCompletion(provider, request, signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        const providerError = error instanceof AiProviderError
          ? error
          : new AiProviderError(
              provider.name,
              "connection",
              error instanceof Error ? error.message : "Неизвестная ошибка соединения.",
            );
        attempts.push(providerError);
        if (this.debug) {
          console.warn("ProjectRA AI provider fallback", {
            provider: provider.name,
            kind: providerError.kind,
            status: providerError.status,
          });
        }
      }
    }

    throw new AiProvidersExhaustedError(attempts);
  }
}

async function requestCompletion(
  provider: ProviderConfig,
  request: AiCompletionRequest,
  signal?: AbortSignal,
): Promise<AiCompletionResult> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), provider.timeoutMs);
  const dispatcher = provider.proxyUrl
    ? new ProxyAgent(
        validatedUrl(provider.proxyUrl, `${envPrefix(provider.name)}_PROXY_URL`),
      )
    : undefined;

  try {
    let response: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      response = await undiciFetch(provider.completionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "ProjectRA/0.1",
        },
        body: JSON.stringify({ ...request, model: provider.model }),
        signal: controller.signal,
        ...(dispatcher ? { dispatcher } : {}),
      });
    } catch (error) {
      if (controller.signal.aborted && !signal?.aborted) {
        throw new AiProviderError(
          provider.name,
          "timeout",
          "Превышен таймаут ответа.",
        );
      }
      throw new AiProviderError(
        provider.name,
        "connection",
        error instanceof Error ? error.message : "Ошибка соединения.",
      );
    }

    const raw = await response.text();
    const payload = parseJson(raw);
    if (!response.ok) {
      throw httpProviderError(provider.name, response.status, payload, raw);
    }

    const message = completionMessage(payload);
    if (!message) {
      throw new AiProviderError(
        provider.name,
        "invalid_response",
        "Провайдер вернул ответ без сообщения.",
        response.status,
      );
    }

    return { message, provider: provider.name, model: provider.model };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
    if (dispatcher) await dispatcher.close();
  }
}

function providerConfigs(): ProviderConfig[] {
  const preferred = preferredProvider();
  const names = [preferred, ...PROVIDER_ORDER.filter((name) => name !== preferred)];

  return names.flatMap((name) => {
    const prefix = envPrefix(name);
    const apiKey = process.env[`${prefix}_API_KEY`]?.trim();
    if (!apiKey) return [];
    const proxyUrl = (
      process.env[`${prefix}_PROXY_URL`]
      || process.env.PROJECTRA_AI_PROXY_URL
      || process.env.HTTPS_PROXY
      || process.env.HTTP_PROXY
      || ""
    ).trim();

    return [{
      name,
      apiKey,
      model: process.env[`${prefix}_MODEL`]?.trim() || DEFAULT_MODELS[name],
      completionUrl: completionUrl(
        process.env[`${prefix}_BASE_URL`]?.trim() || DEFAULT_BASE_URLS[name],
        name,
      ),
      proxyUrl,
      timeoutMs: integerEnv(`${prefix}_TIMEOUT_MS`, 60_000, 5_000, 180_000),
    }];
  });
}

function preferredProvider(): AiProviderName {
  const raw = (
    process.env.PROJECTRA_AI_PROVIDER
    || process.env.AI_PROVIDER
    || "cerebras"
  ).trim().toLowerCase();
  if (!PROVIDER_ORDER.includes(raw as AiProviderName)) {
    throw new AiConfigurationError(
      "PROJECTRA_AI_PROVIDER должен быть cerebras, gemini или groq.",
    );
  }
  return raw as AiProviderName;
}

function completionUrl(raw: string, provider: AiProviderName) {
  const prefix = envPrefix(provider);
  const validated = validatedUrl(raw, `${prefix}_BASE_URL`);
  const url = new URL(validated);
  const path = url.pathname.replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(path)) {
    return url.toString().replace(/\/$/, "");
  }

  const apiPath = provider === "cerebras"
    ? "/v1"
    : provider === "gemini"
      ? "/v1beta/openai"
      : "/openai/v1";
  url.pathname = `${path.endsWith(apiPath) ? path : `${path}${apiPath}`}/chat/completions`;
  return url.toString().replace(/\/$/, "");
}

function completionMessage(payload: unknown): AiCompletionResult["message"] | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") {
    return null;
  }
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const row = message as { content?: unknown; tool_calls?: unknown };
  const content = typeof row.content === "string" || row.content === null
    ? row.content
    : null;
  const toolCalls = Array.isArray(row.tool_calls)
    ? row.tool_calls.filter(isToolCall)
    : undefined;
  return {
    content,
    ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
  };
}

function isToolCall(value: unknown): value is AiToolCall {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string"
    || !row.function
    || typeof row.function !== "object"
  ) {
    return false;
  }
  const fn = row.function as Record<string, unknown>;
  return typeof fn.name === "string" && typeof fn.arguments === "string";
}

function httpProviderError(
  provider: AiProviderName,
  status: number,
  payload: unknown,
  raw: string,
) {
  const kind: AiProviderErrorKind = status === 401 || status === 403
    ? "authentication"
    : status === 429
      ? "rate_limit"
      : status === 400 || status === 422
        ? "bad_request"
        : status === 404
          ? "not_found"
          : "server";
  return new AiProviderError(
    provider,
    kind,
    providerErrorMessage(payload) || raw.slice(0, 500) || `HTTP ${status}`,
    status,
  );
}

function providerErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

function parseJson(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function integerEnv(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AiConfigurationError(
      `${name} должен быть целым числом от ${min} до ${max}.`,
    );
  }
  return value;
}

function validatedUrl(raw: string, name: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AiConfigurationError(`${name} содержит некорректный URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AiConfigurationError(
      `${name} должен использовать http:// или https://.`,
    );
  }
  return url.toString().replace(/\/$/, "");
}

function envPrefix(provider: AiProviderName) {
  return provider.toUpperCase();
}
