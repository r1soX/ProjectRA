import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });
  return new Response("ok");
}
