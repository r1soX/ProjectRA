import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  await prisma.notification.deleteMany({ where: { userId: user.id } });

  return Response.json({ ok: true });
}
