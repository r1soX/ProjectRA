import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";

export const runtime = "nodejs";

const MB = 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return new Response("No file", { status: 400 });
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const kind = isImage ? "image" : isVideo ? "video" : "file";

  // Limits: фото ≤25МБ, видео — без лимита, прочие файлы ≤50МБ.
  const limit = isImage ? 25 * MB : isVideo ? Infinity : 50 * MB;
  if (file.size > limit) {
    return Response.json(
      {
        error: isImage
          ? "Фото не больше 25 МБ"
          : "Файл не больше 50 МБ",
      },
      { status: 413 },
    );
  }

  const saved = await saveUpload(file);
  return Response.json({ ...saved, kind });
}
