import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getTokenSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runProjectraAssistant } from "@/lib/ai/assistant";
import {
  AiConfigurationError,
  AiProvidersExhaustedError,
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
      error: "ИИ-помощник не настроен: добавьте CEREBRAS_API_KEY или GEMINI_API_KEY.",
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

    advanceAiProgress(session.user.id, "Передаю запрос основному ИИ-провайдеру", {
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
  if (error instanceof AiProvidersExhaustedError) {
    const attempts = error.attempts;
    if (attempts.length > 0 && attempts.every((attempt) => attempt.kind === "rate_limit")) {
      return {
        status: 429,
        message: "Лимиты всех настроенных ИИ-провайдеров исчерпаны. Повторите запрос позже.",
      };
    }
    if (attempts.length > 0 && attempts.every((attempt) => attempt.kind === "timeout")) {
      return {
        status: 504,
        message: "Все настроенные ИИ-провайдеры превысили время ожидания. Проверьте прокси.",
      };
    }
    return {
      status: 502,
      message: `ИИ-провайдеры недоступны: ${attempts.map(providerAttemptLabel).join("; ")}.`,
    };
  }
  return { status: 500, message: "ИИ-помощник временно недоступен." };
}

function trimLeadingAssistant<T extends { role: string }>(history: T[]) {
  const firstUser = history.findIndex((message) => message.role === "USER");
  return firstUser > 0 ? history.slice(firstUser) : history;
}

function providerAttemptLabel(attempt: AiProvidersExhaustedError["attempts"][number]) {
  const provider = attempt.provider === "cerebras"
    ? "Cerebras"
    : attempt.provider === "gemini"
      ? "Gemini"
      : "Groq";
  const reason = attempt.kind === "authentication"
    ? "ключ отклонён"
    : attempt.kind === "rate_limit"
      ? "лимит исчерпан"
      : attempt.kind === "timeout"
        ? "таймаут"
        : attempt.kind === "connection"
          ? "нет соединения"
          : attempt.kind === "not_found"
            ? "неверный endpoint или модель"
            : attempt.kind === "bad_request"
              ? "запрос или модель не поддерживаются"
              : "ошибка сервиса";
  return `${provider}: ${reason}`;
}
