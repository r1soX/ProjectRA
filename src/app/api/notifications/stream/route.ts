import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { subscribeUser } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* closed */
        }
      };

      enqueue(`event: ready\ndata: ok\n\n`);
      const unsub = subscribeUser(user.id, (payload) => {
        enqueue(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
      });
      const keepalive = setInterval(() => enqueue(`: keepalive\n\n`), 25000);

      const close = () => {
        clearInterval(keepalive);
        unsub();
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
