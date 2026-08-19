export interface McpConfig {
  projectraBaseUrl: string;
  host: string;
  port: number;
  allowedHosts: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const projectraBaseUrl = env.PROJECTRA_BASE_URL?.trim() || "http://127.0.0.1:3000";
  const host = env.MCP_HOST?.trim() || "127.0.0.1";
  const port = parsePort(env.MCP_PORT);
  const allowedHosts = (env.MCP_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  assertHttpUrl(projectraBaseUrl, "PROJECTRA_BASE_URL");
  if (host !== "127.0.0.1" && host !== "localhost" && allowedHosts.length === 0) {
    throw new Error("MCP_ALLOWED_HOSTS is required when MCP_HOST is not loopback.");
  }

  return { projectraBaseUrl, host, port, allowedHosts };
}

function parsePort(raw: string | undefined): number {
  const value = raw ? Number.parseInt(raw, 10) : 3100;
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error("MCP_PORT must be an integer between 1 and 65535.");
  }
  return value;
}

function assertHttpUrl(raw: string, name: string): void {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must use http:// or https://.`);
  }
}
