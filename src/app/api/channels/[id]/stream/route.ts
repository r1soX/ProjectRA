import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessChannel } from "@/lib/chat";
import { subscribeChannel } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await canAccessChannel(id, user.id))) {
    return new Response("Forbidden", { status: 403 });
  }

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

      send("ready", "ok");
      const unsub = subscribeChannel(id, () => send("change", String(Date.now())));
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          /* closed */
        }
      }, 25000);

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
