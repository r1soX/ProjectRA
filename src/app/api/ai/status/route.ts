import { NextResponse } from "next/server";
import { getTokenSession } from "@/lib/auth";
import { getAiProgress } from "@/lib/ai/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getTokenSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Требуется авторизация." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      progress: getAiProgress(session.user.id) ?? { active: false, events: [] },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
