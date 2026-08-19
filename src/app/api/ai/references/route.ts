import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserBoards } from "@/lib/boards";
import { agentTextIncludes } from "@/lib/agent/search-text";
import { fullName, initials } from "@/lib/names";
import { hasPerm, PERMS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { search } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFERENCE_KINDS = new Set(["user", "project", "task"]);

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return Response.json({ ok: false, error: "Требуется авторизация." }, { status: 401 });

  const url = new URL(request.url);
  const kind = url.searchParams.get("type") ?? "";
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (!REFERENCE_KINDS.has(kind)) {
    return Response.json({ ok: false, error: "Некорректный тип ссылки." }, { status: 400 });
  }

  const [canViewBoards, canViewAllBoards] = await Promise.all([
    hasPerm(user.id, user.role, PERMS.BOARD_VIEW),
    hasPerm(user.id, user.role, PERMS.BOARD_VIEW_ALL),
  ]);

  if (kind === "user") {
    const rows = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 200,
      select: {
        id: true,
        username: true,
        lastName: true,
        firstName: true,
        middleName: true,
        avatar: true,
        avatarEmoji: true,
      },
    });
    const items = rows
      .filter((row) => !query
        || agentTextIncludes(fullName(row), query)
        || agentTextIncludes(row.username, query))
      .sort((left, right) => Number(right.id === user.id) - Number(left.id === user.id))
      .slice(0, 8)
      .map((row) => ({
        type: "user" as const,
        id: row.id,
        label: fullName(row),
        marker: `@${row.username}`,
        detail: `@${row.username}`,
        initials: initials(row),
        avatar: row.avatar,
        emoji: row.avatarEmoji,
      }));
    return Response.json({ ok: true, items });
  }

  if (!canViewBoards) return Response.json({ ok: true, items: [] });

  if (kind === "project") {
    const boards = await getUserBoards(user.id, canViewAllBoards);
    const items = boards
      .filter((board) => agentTextIncludes(board.title, query))
      .slice(0, 10)
      .map((board) => ({
        type: "project" as const,
        id: board.id,
        label: board.title,
        marker: `#${board.title}`,
        detail: "Доска",
        color: board.color ?? "#0ea5e9",
      }));
    return Response.json({ ok: true, items });
  }

  if (query.length < 2) return Response.json({ ok: true, items: [] });
  const result = await search(user.id, canViewAllBoards, query);
  const items = result.tasks.slice(0, 10).map((task) => ({
    type: "task" as const,
    id: task.id,
    label: task.title,
    marker: `$${task.title}`,
    detail: task.boardTitle,
    boardId: task.boardId,
    color: task.boardColor,
  }));
  return Response.json({ ok: true, items });
}
