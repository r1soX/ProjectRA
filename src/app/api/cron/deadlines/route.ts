import { NextRequest } from "next/server";
import { checkDeadlines } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Simple secret so only authorized callers can trigger this.
// In production use CRON_SECRET env var; in dev it's optional.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  await checkDeadlines();
  return Response.json({ ok: true });
}
