import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserBoards } from "@/lib/boards";
import { search } from "@/lib/search";
import { hasPerm, PERMS } from "@/lib/permissions";
import { fullName, initials } from "@/lib/names";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const ql = q.toLowerCase();
  const isAdmin = user.role === "ADMIN";

  const canBoards = await hasPerm(user.id, user.role, PERMS.BOARD_VIEW);

  // Boards: all of the user's boards when idle (for navigation/quick-add),
  // filtered by the query otherwise.
  const allBoards = canBoards ? await getUserBoards(user.id) : [];
  const boards = allBoards
    .filter((b) => !ql || b.title.toLowerCase().includes(ql))
    .slice(0, 12)
    .map((b) => ({ id: b.id, title: b.title, color: b.color ?? "#0ea5e9" }));

  // Tasks via the shared search (respects access + personal-task rules).
  const tasks =
    canBoards && q.length >= 2 ? (await search(user.id, isAdmin, q)).tasks.slice(0, 8) : [];

  // People (for opening a DM).
  let users: {
    id: string;
    fullName: string;
    username: string;
    initials: string;
    avatar: string | null;
    emoji: string | null;
  }[] = [];
  if (q.length >= 1) {
    const rows = await prisma.user.findMany({
      where: { isActive: true, id: { not: user.id } },
      select: {
        id: true,
        username: true,
        lastName: true,
        firstName: true,
        middleName: true,
        avatar: true,
        avatarEmoji: true,
      },
      take: 200,
    });
    users = rows
      .filter(
        (u) =>
          fullName(u).toLowerCase().includes(ql) ||
          u.username.toLowerCase().includes(ql),
      )
      .slice(0, 6)
      .map((u) => ({
        id: u.id,
        fullName: fullName(u),
        username: u.username,
        initials: initials(u),
        avatar: u.avatar,
        emoji: u.avatarEmoji,
      }));
  }

  return Response.json({ boards, tasks, users });
}
