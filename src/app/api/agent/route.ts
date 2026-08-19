import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getUserFromSessionToken } from "@/lib/auth";
import { agentRequestSchema } from "@/lib/agent/contracts";
import { AgentServiceError, ProjectraAgentService } from "@/lib/agent/service";

export const runtime = "nodejs";

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1];
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const session = await getUserFromSessionToken(bearerToken(request));
  if (!session) {
    return response(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Требуется действующий bearer-токен ProjectRA." } },
      401,
    );
  }

  try {
    const parsed = agentRequestSchema.parse(await request.json());
    const service = new ProjectraAgentService(session.user, session.expiresAt);
    return response({ ok: true, data: await service.execute(parsed) });
  } catch (error) {
    if (error instanceof ZodError) {
      return response(
        { ok: false, error: { code: "INVALID_ARGUMENT", message: error.issues[0]?.message ?? "Некорректные параметры операции." } },
        400,
      );
    }
    if (error instanceof AgentServiceError) {
      return response(
        { ok: false, error: { code: error.code, message: error.message } },
        error.status,
      );
    }
    console.error("Agent API operation failed", error);
    return response(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Операция не выполнена из-за внутренней ошибки." } },
      500,
    );
  }
}

