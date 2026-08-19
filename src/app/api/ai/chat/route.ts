import { NextResponse, type NextRequest } from "next/server";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
} from "groq-sdk";
import { z } from "zod";
import { getTokenSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runProjectraAssistant } from "@/lib/ai/assistant";
import {
  AiConfigurationError,
  isAiConfigured,
} from "@/lib/ai/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(8_000),
}).strict();

const activeUsers = new Set<string>();

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const session = await getTokenSession();
  if (!session) return response({ ok: false, error: "Требуется авторизация." }, 401);

  const conversation = await prisma.aiConversation.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, role: true, body: true, actions: true, createdAt: true },
      },
    },
  });

  return response({
    ok: true,
    configured: isAiConfigured(),
    conversationId: conversation?.id ?? null,
    messages: [...(conversation?.messages ?? [])].reverse().map(messageView),
  });
}

export async function POST(request: NextRequest) {
  const session = await getTokenSession();
  if (!session) return response({ ok: false, error: "Требуется авторизация." }, 401);
  if (!isAiConfigured()) {
    return response({ ok: false, error: "ИИ-помощник не настроен: отсутствует GROQ_API_KEY." }, 503);
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return response({ ok: false, error: parsed.error.issues[0]?.message ?? "Некорректное сообщение." }, 400);
  }
  if (activeUsers.has(session.user.id)) {
    return response({ ok: false, error: "Предыдущий запрос ИИ ещё выполняется." }, 409);
  }

  activeUsers.add(session.user.id);
  try {
    const conversation = await prisma.aiConversation.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id },
      update: {},
      select: { id: true },
    });
    const userMessage = await prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        body: parsed.data.message,
      },
      select: { id: true, role: true, body: true, actions: true, createdAt: true },
    });
    const history = await prisma.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { role: true, body: true },
    });

    const result = await runProjectraAssistant(
      session,
      history.reverse().map((message) => ({
        role: message.role === "USER" ? "USER" : "ASSISTANT",
        body: message.body,
      })),
      request.signal,
    );
    const assistantMessage = await prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        body: result.content,
        actions: result.actions.length ? JSON.stringify(result.actions) : null,
      },
      select: { id: true, role: true, body: true, actions: true, createdAt: true },
    });
    await prisma.aiConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return response({
      ok: true,
      model: result.model,
      userMessage: messageView(userMessage),
      assistantMessage: messageView(assistantMessage),
    });
  } catch (error) {
    const mapped = publicAiError(error);
    if (mapped.status >= 500) console.error("ProjectRA AI chat failed", error);
    return response({ ok: false, error: mapped.message }, mapped.status);
  } finally {
    activeUsers.delete(session.user.id);
  }
}

export async function DELETE() {
  const session = await getTokenSession();
  if (!session) return response({ ok: false, error: "Требуется авторизация." }, 401);
  const conversation = await prisma.aiConversation.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (conversation) {
    await prisma.aiMessage.deleteMany({ where: { conversationId: conversation.id } });
    await prisma.aiConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
  }
  return response({ ok: true });
}

function messageView(message: {
  id: string;
  role: string;
  body: string;
  actions: string | null;
  createdAt: Date;
}) {
  return {
    id: message.id,
    role: message.role === "USER" ? "user" : "assistant",
    content: message.body,
    actions: parseActions(message.actions),
    createdAt: message.createdAt.toISOString(),
  };
}

function parseActions(raw: string | null) {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function publicAiError(error: unknown) {
  if (error instanceof AiConfigurationError) return { status: 503, message: error.message };
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return { status: 502, message: "Groq отклонил ключ. Проверьте GROQ_API_KEY." };
  }
  if (error instanceof RateLimitError) {
    return { status: 429, message: "Достигнут лимит Groq. Повторите запрос немного позже." };
  }
  if (error instanceof APIConnectionTimeoutError) {
    return { status: 504, message: "Groq не ответил вовремя. Проверьте HTTP-прокси и повторите запрос." };
  }
  if (error instanceof APIConnectionError) {
    return { status: 502, message: "Не удалось подключиться к Groq. Проверьте GROQ_PROXY_URL и доступ к сети." };
  }
  if (error instanceof BadRequestError) {
    return { status: 502, message: "Groq не смог обработать запрос к модели. Проверьте GROQ_MODEL." };
  }
  return { status: 500, message: "ИИ-помощник временно недоступен." };
}
