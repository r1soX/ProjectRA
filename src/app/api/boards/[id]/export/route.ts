import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getBoardWithData } from "@/lib/boards";
import { hasPerm, PERMS } from "@/lib/permissions";
import { shortName } from "@/lib/names";
import { normalizePriority, PRIORITY_META } from "@/lib/priority";

export const runtime = "nodejs";

function csvCell(v: string | null | undefined): string {
  const s = (v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

function ymd(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") === "json" ? "json" : "csv";

  const result = await getBoardWithData(id, user.id, user.role === "ADMIN");
  if (!result) return new Response("Not found", { status: 404 });
  const { board } = result;

  // CSV → flat task list (EXPORT_TASKS); JSON → full board structure (EXPORT_BOARD).
  const needed = format === "json" ? PERMS.EXPORT_BOARD : PERMS.EXPORT_TASKS;
  if (!(await hasPerm(user.id, user.role, needed))) {
    return new Response("Forbidden", { status: 403 });
  }

  // HTTP header values are latin1, so non-ASCII titles need an ASCII fallback
  // plus an RFC 5987 filename* with the UTF-8 name.
  const baseName = (board.title.trim() || "board").slice(0, 60);
  const asciiName =
    baseName.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_") || "board";
  const utf8Name = encodeURIComponent(baseName);
  const disposition = (ext: string) =>
    `attachment; filename="${asciiName}.${ext}"; filename*=UTF-8''${utf8Name}.${ext}`;

  if (format === "json") {
    const data = {
      title: board.title,
      isPersonal: board.isPersonal,
      exportedAt: new Date().toISOString(),
      columns: board.columns.map((c) => ({
        title: c.title,
        systemKey: c.systemKey,
        tasks: c.tasks.map((t) => ({
          title: t.title,
          description: t.description,
          priority: normalizePriority(t.priority),
          startDate: ymd(t.startDate),
          dueDate: ymd(t.dueDate),
          createdBy: shortName(t.createdBy),
          assignees: t.assignees.map((a) => shortName(a.user)),
          labels: t.labels.map((tl) => tl.label.name),
        })),
      })),
    };
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": disposition("json"),
      },
    });
  }

  // CSV
  const header = [
    "Колонка", "Задача", "Срочность", "Исполнители",
    "Начало", "Срок", "Постановщик", "Метки",
  ];
  const rows: string[] = [header.map(csvCell).join(",")];
  for (const c of board.columns) {
    for (const t of c.tasks) {
      rows.push(
        [
          c.title,
          t.title,
          PRIORITY_META[normalizePriority(t.priority)].label,
          t.assignees.map((a) => shortName(a.user)).join(", "),
          ymd(t.startDate),
          ymd(t.dueDate),
          shortName(t.createdBy),
          t.labels.map((tl) => tl.label.name).join(", "),
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  // BOM so Excel reads UTF-8 correctly.
  const csv = "﻿" + rows.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": disposition("csv"),
    },
  });
}
