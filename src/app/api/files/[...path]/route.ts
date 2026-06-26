import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { readUpload, mimeFromExt } from "@/lib/upload";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { path: segments } = await params;
  const relative = segments.join("/");
  const data = await readUpload(relative);
  if (!data) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeFromExt(relative),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
