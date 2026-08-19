import type {
  AgentOperation,
  GatewayResponse,
  IdentityResult,
  JsonValue,
  ProjectraGateway,
} from "./types.js";

export class GatewayError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

export interface GatewayClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export class ProjectraGatewayClient implements ProjectraGateway {
  private readonly endpoint: URL;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GatewayClientOptions) {
    this.endpoint = new URL("/api/agent", ensureTrailingSlash(options.baseUrl));
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async call<T extends JsonValue>(
    operation: AgentOperation,
    input: Record<string, JsonValue> = {},
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ operation, input }),
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new GatewayError(
        "projectra_unavailable",
        "ProjectRA is unavailable. Check PROJECTRA_BASE_URL and the application status.",
      );
    }

    let payload: GatewayResponse<T> | undefined;
    try {
      payload = (await response.json()) as GatewayResponse<T>;
    } catch {
      throw new GatewayError(
        "invalid_gateway_response",
        `ProjectRA returned an invalid response (HTTP ${response.status}).`,
        response.status,
      );
    }

    if (!response.ok || !payload.ok) {
      const failure = payload as Extract<GatewayResponse<T>, { ok: false }>;
      throw new GatewayError(
        failure.error?.code ?? `http_${response.status}`,
        failure.error?.message ?? "ProjectRA rejected the operation.",
        response.status,
      );
    }

    return payload.data;
  }

  whoAmI(signal?: AbortSignal): Promise<IdentityResult> {
    return this.call<IdentityResult & { [key: string]: JsonValue }>(
      "whoami",
      {},
      signal,
    );
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
