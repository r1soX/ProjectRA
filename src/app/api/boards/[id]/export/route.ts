import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shortName } from "@/lib/names";

function escapeCsv(v: string | null | undefined) {
  if (!v) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cols: (string | null | undefined)[]) {
  return cols.map(escapeCsv).join(",") + "\n";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id: boardId } = await params;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      title: true,
      isPersonal: true,
      ownerId: true,
      members: { select: { userId: true } },
      columns: {
        orderBy: { order: "asc" },
        select: {
          title: true,
          tasks: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              description: true,
              priority: true,
              isPersonal: true,
              startDate: true,
              dueDate: true,
              createdAt: true,
              color: true,
              createdBy: {
                select: { lastName: true, firstName: true, middleName: true },
              },
              assignees: {
                select: {
                  user: { select: { lastName: true, firstName: true, middleName: true } },
                },
              },
              labels: {
                select: { label: { select: { name: true } } },
              },
              timeEntries: {
                select: { minutes: true },
              },
            },
          },
        },
      },
    },
  });

  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Access check
  if (
    board.isPersonal &&
    board.ownerId !== user.id &&
    !board.members.some((m) => m.userId === user.id) &&
    user.role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const PRIORITY_RU: Record<string, string> = {
    LOW: "Низкий",
    MEDIUM: "Средний",
    URGENT: "Срочный",
  };

  let csv = row(
    "ID",
    "Колонка",
    "Название",
    "Описание",
    "Приоритет",
    "Создатель",
    "Исполнители",
    "Метки",
    "Начало",
    "Срок",
    "Создано",
    "Время (мин)",
  );

  for (const col of board.columns) {
    for (const t of col.tasks) {
      const assigneeNames = t.assignees.map((a) => shortName(a.user)).join("; ");
      const labelNames = t.labels.map((l) => l.label.name).join("; ");
      const totalMins = t.timeEntries.reduce((s, e) => s + e.minutes, 0);
      csv += row(
        t.id,
        col.title,
        t.title,
        t.description,
        PRIORITY_RU[t.priority] ?? t.priority,
        shortName(t.createdBy),
        assigneeNames,
        labelNames,
        t.startDate ? t.startDate.toISOString().slice(0, 10) : null,
        t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
        t.createdAt.toISOString().slice(0, 10),
        totalMins > 0 ? String(totalMins) : null,
      );
    }
  }

  const safeName =
    board.title.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") ||
    "board";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.csv"; filename*=UTF-8''${encodeURIComponent(board.title)}.csv`,
    },
  });
}
