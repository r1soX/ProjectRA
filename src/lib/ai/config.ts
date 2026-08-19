import "server-only";

import Groq from "groq-sdk";
import { fetch as undiciFetch, ProxyAgent } from "undici";

const DEFAULT_BASE_URL = "https://api.groq.com";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
type GroqClientOptions = NonNullable<ConstructorParameters<typeof Groq>[0]>;

export type GroqAssistantConfig = {
  model: string;
  maxCompletionTokens: number;
  maxToolRounds: number;
  debug: boolean;
};

type CachedClient = {
  client: Groq;
  config: GroqAssistantConfig;
};

let cached: CachedClient | null = null;

export class AiConfigurationError extends Error {}

export function isAiConfigured() {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function getGroqAssistant(): CachedClient {
  if (cached) return cached;

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new AiConfigurationError("ИИ-помощник не настроен: отсутствует GROQ_API_KEY.");
  }

  const baseURL = normalizedGroqBaseUrl(
    process.env.GROQ_BASE_URL?.trim() || DEFAULT_BASE_URL,
  );
  const proxyUrl = (
    process.env.GROQ_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    ""
  ).trim();
  const dispatcher = proxyUrl
    ? new ProxyAgent(validatedUrl(proxyUrl, "GROQ_PROXY_URL"))
    : undefined;
  // Node 22's built-in fetch can bundle a different Undici protocol version.
  // Keep fetch and ProxyAgent from the same package to avoid dispatcher ABI
  // errors such as "invalid onRequestStart method".
  const proxyFetch: GroqClientOptions["fetch"] = dispatcher
    ? async (input, init) => {
        const response = await undiciFetch(
          input as unknown as Parameters<typeof undiciFetch>[0],
          {
            ...(init ?? {}),
            dispatcher,
          } as unknown as NonNullable<Parameters<typeof undiciFetch>[1]>,
        );
        return response as unknown as globalThis.Response;
      }
    : undefined;

  const config: GroqAssistantConfig = {
    model: process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL,
    maxCompletionTokens: integerEnv("GROQ_MAX_COMPLETION_TOKENS", 2_048, 256, 16_384),
    maxToolRounds: integerEnv("GROQ_MAX_TOOL_ROUNDS", 6, 1, 10),
    debug: process.env.PROJECTRA_AI_DEBUG?.trim() === "1",
  };

  cached = {
    client: new Groq({
      apiKey,
      baseURL,
      timeout: integerEnv("GROQ_TIMEOUT_MS", 60_000, 5_000, 180_000),
      maxRetries: 2,
      logLevel: "warn",
      ...(proxyFetch ? { fetch: proxyFetch } : {}),
    }),
    config,
  };
  return cached;
}

function integerEnv(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AiConfigurationError(`${name} должен быть целым числом от ${min} до ${max}.`);
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
    throw new AiConfigurationError(`${name} должен использовать http:// или https://.`);
  }
  return url.toString().replace(/\/$/, "");
}

function normalizedGroqBaseUrl(raw: string) {
  const validated = validatedUrl(raw, "GROQ_BASE_URL");
  const url = new URL(validated);
  // groq-sdk appends /openai/v1 itself. Accept the old documented value too,
  // so existing deployments do not produce /openai/v1/openai/v1/...
  url.pathname = url.pathname.replace(/\/openai\/v1\/?$/, "") || "/";
  return url.toString().replace(/\/$/, "");
}
