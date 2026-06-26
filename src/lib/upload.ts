import "server-only";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
};

export function mimeFromExt(name: string): string {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] ?? "application/octet-stream";
}

/** Persist an uploaded File to the uploads dir, returning its access info. */
export async function saveUpload(file: File) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name).toLowerCase();
  const filename = `${crypto.randomBytes(12).toString("hex")}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buf);
  return {
    url: `/api/files/${filename}`,
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

/** Read a stored file (path-traversal safe), or null if missing. */
export async function readUpload(relative: string) {
  if (relative.includes("..") || path.isAbsolute(relative)) return null;
  const full = path.join(UPLOAD_DIR, relative);
  return readFile(full).catch(() => null);
}
