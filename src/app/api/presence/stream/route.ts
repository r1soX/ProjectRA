import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  presenceConnect,
  presenceDisconnect,
  onlineUserIds,
  publishPresence,
  subscribePresence,
} from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const uid = user.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          /* closed */
        }
      };

      // Mark online.
      if (presenceConnect(uid)) {
        prisma.user
          .update({ where: { id: uid }, data: { lastSeenAt: new Date() } })
          .catch(() => {});
        publishPresence(uid, true);
      }

      // Seed the current online set, then stream changes.
      send("init", JSON.stringify(onlineUserIds()));
      const unsub = subscribePresence((e) => send("presence", JSON.stringify(e)));
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ka\n\n`));
        } catch {
          /* closed */
        }
      }, 25000);

      const close = () => {
        clearInterval(keepalive);
        unsub();
        if (presenceDisconnect(uid)) {
          prisma.user
            .update({ where: { id: uid }, data: { lastSeenAt: new Date() } })
            .catch(() => {});
          publishPresence(uid, false);
        }
        try {
          controller.close();
        } catch {
          /* closed */
        }
      };
      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
