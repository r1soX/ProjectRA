import "server-only";
import { prisma } from "./prisma";
import { DEFAULT_STATUSES, defaultStatusOf, type StatusDef } from "./status";

/** Seed the built-in statuses once, if the table is empty. */
export async function ensureStatuses() {
  const count = await prisma.statusDef.count();
  if (count > 0) return;
  await prisma.statusDef.createMany({
    data: DEFAULT_STATUSES.map((s, i) => ({
      key: s.key,
      label: s.label,
      color: s.color,
      order: i,
      isSystem: true,
    })),
  });
}

/** The ordered list of statuses (seeding defaults on first access). */
export async function getStatuses(): Promise<StatusDef[]> {
  await ensureStatuses();
  const rows = await prisma.statusDef.findMany({ orderBy: { order: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    color: r.color,
    order: r.order,
    isSystem: r.isSystem,
  }));
}

/** Set of valid status keys (for server-side validation). */
export async function statusKeySet(): Promise<Set<string>> {
  const rows = await prisma.statusDef.findMany({ select: { key: true } });
  return new Set(rows.map((r) => r.key));
}

/** Human label for a status key (for history/logs). */
export async function statusLabel(key: string): Promise<string> {
  const row = await prisma.statusDef.findUnique({
    where: { key },
    select: { label: true },
  });
  return row?.label ?? defaultStatusOf(key).label;
}
