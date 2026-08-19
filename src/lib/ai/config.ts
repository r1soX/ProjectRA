import "server-only";

import { fetch as undiciFetch, ProxyAgent } from "undici";
import {
  normalizeCompletionMessage,
  type AiCompletionMessage,
  type AiToolCall,
} from "./protocol";

export type { AiToolCall } from "./protocol";

export type AiChatTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AiChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: AiToolCall[];
      reasoning?: string;
      reasoning_details?: unknown[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export type AiCompletionRequest = {
  messages: AiChatMessage[];
  tools?: AiChatTool[];
  tool_choice?: "auto" | "none" | "required";
  parallel_tool_calls?: boolean;
  temperature?: number;
  max_completion_tokens?: number;
  session_id?: string;
};

export type AiCompletionResult = {
  message: AiCompletionMessage;
  model: string;
};

export type AiAssistantConfig = {
  maxCompletionTokens: number;
  maxToolRounds: number;
  historyMessages: number;
  debug: boolean;
};

type OpenRouterConfig = {
  apiKey: string;
  model: string;
  completionUrl: string;
  proxyUrl: string;
  timeoutMs: number;
  siteUrl: string;
  appName: string;
};

type CachedAssistant = {
  client: AiCompletionClient;
  config: AiAssistantConfig;
};

export type AiOpenRouterErrorKind =
  | "authentication"
  | "credits"
  | "forbidden"
  | "rate_limit"
  | "timeout"
  | "connection"
  | "bad_request"
  | "not_found"
  | "unavailable"
  | "server"
  | "invalid_response";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
let cached: CachedAssistant | null = null;

export class AiConfigurationError extends Error {}

export class AiOpenRouterError extends Error {
  constructor(
    public readonly kind: AiOpenRouterErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiOpenRouterError";
  }
}

export function isAiConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function getAiHistoryMessageLimit() {
  return integerEnv("PROJECTRA_AI_HISTORY_MESSAGES", 12, 4, 30);
}

export function getAiAssistant(): CachedAssistant {
  if (cached) return cached;

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new AiConfigurationError(
      "ИИ-помощник не настроен: отсутствует OPENROUTER_API_KEY.",
    );
  }

  const clientConfig: OpenRouterConfig = {
    apiKey,
    model: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL,
    completionUrl: completionUrl(
      process.env.OPENROUTER_BASE_URL?.trim() || DEFAULT_BASE_URL,
    ),
    proxyUrl: (
      process.env.OPENROUTER_PROXY_URL
      || process.env.PROJECTRA_AI_PROXY_URL
      || process.env.HTTPS_PROXY
      || process.env.HTTP_PROXY
      || ""
    ).trim(),
    timeoutMs: integerEnv("OPENROUTER_TIMEOUT_MS", 60_000, 5_000, 180_000),
    siteUrl: optionalUrl(process.env.OPENROUTER_SITE_URL, "OPENROUTER_SITE_URL"),
    appName: process.env.OPENROUTER_APP_NAME?.trim() || "ProjectRA",
  };
  const config: AiAssistantConfig = {
    maxCompletionTokens: integerEnv(
      "PROJECTRA_AI_MAX_COMPLETION_TOKENS",
      2_048,
      256,
      16_384,
    ),
    maxToolRounds: integerEnv("PROJECTRA_AI_MAX_TOOL_ROUNDS", 8, 1, 10),
    historyMessages: getAiHistoryMessageLimit(),
    debug: process.env.PROJECTRA_AI_DEBUG?.trim() === "1",
  };

  cached = { client: new AiCompletionClient(clientConfig), config };
  return cached;
}

class AiCompletionClient {
  constructor(private readonly config: OpenRouterConfig) {}

  async create(
    request: AiCompletionRequest,
    signal?: AbortSignal,
  ): Promise<AiCompletionResult> {
    return requestCompletion(this.config, request, signal);
  }
}

async function requestCompletion(
  config: OpenRouterConfig,
  request: AiCompletionRequest,
  signal?: AbortSignal,
): Promise<AiCompletionResult> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const dispatcher = config.proxyUrl
    ? new ProxyAgent(validatedUrl(config.proxyUrl, "OPENROUTER_PROXY_URL"))
    : undefined;

  try {
    let response: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      response = await undiciFetch(config.completionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "ProjectRA/0.1",
          ...(config.siteUrl ? { "HTTP-Referer": config.siteUrl } : {}),
          ...(config.appName ? { "X-OpenRouter-Title": config.appName } : {}),
        },
        body: JSON.stringify({ ...request, model: config.model }),
        signal: controller.signal,
        ...(dispatcher ? { dispatcher } : {}),
      });
    } catch (error) {
      if (controller.signal.aborted && !signal?.aborted) {
        throw new AiOpenRouterError("timeout", "Превышен таймаут ответа OpenRouter.");
      }
      throw new AiOpenRouterError(
        "connection",
        error instanceof Error ? error.message : "Ошибка соединения с OpenRouter.",
      );
    }

    const raw = await response.text();
    const payload = parseJson(raw);
    if (!response.ok) {
      throw openRouterHttpError(response.status, payload, raw);
    }

    const message = normalizeCompletionMessage(payload);
    if (!message) {
      throw new AiOpenRouterError(
        "invalid_response",
        "OpenRouter вернул ответ без сообщения.",
        response.status,
      );
    }

    return {
      message,
      model: completionModel(payload) || config.model,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
    if (dispatcher) await dispatcher.close();
  }
}

function completionUrl(raw: string) {
  const validated = validatedUrl(raw, "OPENROUTER_BASE_URL");
  const url = new URL(validated);
  const path = url.pathname.replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(path)) {
    return url.toString().replace(/\/$/, "");
  }
  url.pathname = `${path}/chat/completions`;
  return url.toString().replace(/\/$/, "");
}

function openRouterHttpError(status: number, payload: unknown, raw: string) {
  const kind: AiOpenRouterErrorKind = status === 401
    ? "authentication"
    : status === 402
      ? "credits"
      : status === 403
        ? "forbidden"
        : status === 408
          ? "timeout"
          : status === 429
            ? "rate_limit"
            : status === 400 || status === 422
              ? "bad_request"
              : status === 404
                ? "not_found"
                : status === 502 || status === 503
                  ? "unavailable"
                  : "server";
  return new AiOpenRouterError(
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

function completionModel(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const model = (payload as { model?: unknown }).model;
  return typeof model === "string" ? model : "";
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

function optionalUrl(raw: string | undefined, name: string) {
  const value = raw?.trim();
  return value ? validatedUrl(value, name) : "";
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
