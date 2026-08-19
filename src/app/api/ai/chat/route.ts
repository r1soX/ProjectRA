import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getTokenSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runProjectraAssistant } from "@/lib/ai/assistant";
import {
  AiConfigurationError,
  AiOpenRouterError,
  getAiHistoryMessageLimit,
  isAiConfigured,
} from "@/lib/ai/config";
import {
  advanceAiProgress,
  beginAiProgress,
  completeAiProgress,
  failAiProgress,
} from "@/lib/ai/progress";

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
    return response({
      ok: false,
      error: "ИИ-помощник не настроен: добавьте OPENROUTER_API_KEY.",
    }, 503);
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return response({ ok: false, error: parsed.error.issues[0]?.message ?? "Некорректное сообщение." }, 400);
  }
  if (activeUsers.has(session.user.id)) {
    return response({ ok: false, error: "Предыдущий запрос ИИ ещё выполняется." }, 409);
  }

  activeUsers.add(session.user.id);
  beginAiProgress(session.user.id, "Сохраняю запрос и загружаю контекст");
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
      take: getAiHistoryMessageLimit(),
      select: { role: true, body: true },
    });

    advanceAiProgress(session.user.id, "Передаю запрос в OpenRouter", {
      phase: "thinking",
      round: 1,
    });

    const result = await runProjectraAssistant(
      session,
      trimLeadingAssistant(history.reverse()).map((message) => ({
        role: message.role === "USER" ? "USER" : "ASSISTANT",
        body: message.body,
      })),
      request.signal,
      (label, meta) => advanceAiProgress(session.user.id, label, meta),
    );
    advanceAiProgress(session.user.id, "Сохраняю ответ в истории чата", {
      phase: "finalizing",
    });
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
    completeAiProgress(session.user.id);

    return response({
      ok: true,
      model: result.model,
      userMessage: messageView(userMessage),
      assistantMessage: messageView(assistantMessage),
    });
  } catch (error) {
    const mapped = publicAiError(error);
    failAiProgress(session.user.id, mapped.message);
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
  if (error instanceof AiOpenRouterError) {
    if (error.kind === "authentication") {
      return { status: 502, message: "OpenRouter отклонил API-ключ. Проверьте OPENROUTER_API_KEY." };
    }
    if (error.kind === "credits") {
      return { status: 402, message: "На балансе OpenRouter недостаточно средств." };
    }
    if (error.kind === "forbidden") {
      return { status: 502, message: "OpenRouter запретил запрос для выбранной модели или ключа." };
    }
    if (error.kind === "rate_limit") {
      return { status: 429, message: "OpenRouter ограничил частоту запросов. Повторите позже." };
    }
    if (error.kind === "timeout") {
      return { status: 504, message: "OpenRouter превысил время ожидания. Проверьте сеть или прокси." };
    }
    if (error.kind === "not_found") {
      return { status: 502, message: "Модель OPENROUTER_MODEL не найдена в OpenRouter." };
    }
    if (error.kind === "bad_request") {
      return { status: 502, message: "OpenRouter или выбранная модель отклонили запрос." };
    }
    if (error.kind === "unavailable") {
      return { status: 503, message: "OpenRouter временно не нашёл доступный сервер модели." };
    }
    return { status: 502, message: "OpenRouter временно недоступен." };
  }
  return { status: 500, message: "ИИ-помощник временно недоступен." };
}

function trimLeadingAssistant<T extends { role: string }>(history: T[]) {
  const firstUser = history.findIndex((message) => message.role === "USER");
  return firstUser > 0 ? history.slice(firstUser) : history;
}
