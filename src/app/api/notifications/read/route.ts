import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await req.json().catch(() => ({}));

  if (id) {
    // mark single notification read (only own)
    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { isRead: true },
    });
  } else {
    // mark all read
    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
  }

  return Response.json({ ok: true });
}
