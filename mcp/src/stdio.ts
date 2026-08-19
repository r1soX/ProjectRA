import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { loadConfig } from "./config.js";
import { ProjectraGatewayClient } from "./gateway.js";
import { createProjectraMcpServer } from "./server.js";

const config = loadConfig();
const token = process.env.PROJECTRA_TOKEN?.trim();

if (!token) {
  console.error("PROJECTRA_TOKEN is required for the stdio transport.");
  process.exitCode = 1;
} else {
  void serveStdio(() =>
    createProjectraMcpServer(
      new ProjectraGatewayClient({
        baseUrl: config.projectraBaseUrl,
        token,
      }),
    ),
  );
  console.error("ProjectRA MCP running on stdio.");
}
