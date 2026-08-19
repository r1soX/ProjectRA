import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { SESSION_MAX_AGE, signSession } from "@/lib/session";

export const runtime = "nodejs";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(1024),
}).strict();

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return response({ ok: false, error: { code: "INVALID_ARGUMENT", message: "Укажите username и password." } }, 400);
  }
  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true, passwordHash: true, isActive: true },
  });
  if (!user || !user.isActive || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return response({ ok: false, error: { code: "INVALID_CREDENTIALS", message: "Неверный логин или пароль." } }, 401);
  }
  return response({
    ok: true,
    data: {
      tokenType: "Bearer",
      accessToken: await signSession(user.id),
      expiresIn: SESSION_MAX_AGE,
    },
  });
}
