import { createMcpExpressApp, requireBearerAuth } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  createMcpHandler,
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";

import { loadConfig } from "./config.js";
import { ProjectraGatewayClient } from "./gateway.js";
import { createProjectraMcpServer } from "./server.js";

const config = loadConfig();

const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      const identity = await new ProjectraGatewayClient({
        baseUrl: config.projectraBaseUrl,
        token,
      }).whoAmI();
      return {
        token,
        clientId: identity.id,
        scopes: ["projectra"],
        expiresAt: identity.expiresAt,
        extra: { username: identity.username, displayName: identity.displayName },
      };
    } catch {
      throw new OAuthError(OAuthErrorCode.InvalidToken, "The ProjectRA token is invalid or expired.");
    }
  },
};

const handler = createMcpHandler(({ authInfo }) => {
  if (!authInfo?.token) throw new Error("Authenticated ProjectRA token is required.");
  return createProjectraMcpServer(
    new ProjectraGatewayClient({
      baseUrl: config.projectraBaseUrl,
      token: authInfo.token,
    }),
  );
});

const app = createMcpExpressApp({
  host: config.host,
  ...(config.allowedHosts.length ? { allowedHosts: config.allowedHosts } : {}),
});
const auth = requireBearerAuth({ verifier, requiredScopes: ["projectra"] });
const nodeHandler = toNodeHandler(handler);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "projectra-mcp" });
});
app.all("/mcp", auth, (req, res) => void nodeHandler(req, res, req.body));

const listener = app.listen(config.port, config.host, () => {
  console.error(`ProjectRA MCP listening on http://${config.host}:${config.port}/mcp`);
});

async function shutdown(): Promise<void> {
  listener.close();
  await handler.close();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
