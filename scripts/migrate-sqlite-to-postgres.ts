/**
 * One-time data migration: SQLite (prisma/dev.db) → the CURRENT Prisma
 * datasource (PostgreSQL). Preserves ids and relations.
 *
 * Run AFTER the Postgres schema exists (`prisma db push`) and against an EMPTY
 * Postgres DB. Idempotent (skipDuplicates), so it's safe to re-run.
 *
 *   node --experimental-sqlite --import tsx scripts/migrate-sqlite-to-postgres.ts
 *   # options via env:
 *   #   SQLITE_PATH=./prisma/dev.db   (source file)
 *   #   DRY_RUN=1                      (read + convert, no writes)
 *
 * IMPORTANT: SQLite in WAL mode keeps recent writes in a separate `-wal` file.
 * If you migrate only the main `dev.db` (e.g. mounting a single file into a
 * container) you'll MISS that data. Fold the WAL into the main file first:
 *   sqlite3 dev.db 'PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;'
 * When run locally alongside `dev.db-wal`/`dev.db-shm`, this script already sees
 * WAL data (it opens read-only with the sidecar files present).
 *
 * Requires Node ≥ 22.5 (for node:sqlite).
 */
import { DatabaseSync } from "node:sqlite";
import { PrismaClient, Prisma } from "@prisma/client";

const SQLITE_PATH = process.env.SQLITE_PATH ?? "prisma/dev.db";
const DRY_RUN = process.env.DRY_RUN === "1";

// Insertion order that satisfies foreign keys (parents before children).
const ORDER = [
  "User",
  "StatusDef",
  "RolePermission",
  "UserPermission",
  "Board",
  "BoardMember",
  "BoardOrder",
  "Column",
  "Label",
  "Task",
  "TaskAssignee",
  "TaskLabel",
  "TaskLink",
  "Comment",
  "CommentReaction",
  "TaskHistory",
  "TimeEntry",
  "TaskAttachment",
  "Channel",
  "ChannelMember",
  "ChannelRead",
  "Message",
  "Notification",
  "BoardTemplate",
  "TemplateColumn",
  "AuditLog",
] as const;

const prisma = new PrismaClient();
const modelByName = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [m.name, m]),
);

/** field name → scalar type ("Boolean" | "DateTime" | ...) for a model. */
function scalarTypes(model: string): Record<string, string> {
  const m = modelByName.get(model);
  const out: Record<string, string> = {};
  for (const f of m?.fields ?? []) {
    if (f.kind === "scalar") out[f.name] = f.type;
  }
  return out;
}

/** Convert a raw SQLite row to Prisma-typed data (0/1→bool, ms→Date). */
function convertRow(row: Record<string, unknown>, types: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) {
      out[k] = null;
      continue;
    }
    const t = types[k];
    if (t === "Boolean") out[k] = Boolean(v);
    else if (t === "DateTime") out[k] = new Date(v as number);
    else out[k] = v;
  }
  return out;
}

/** Order tasks so a parent always precedes its children (any depth). */
function sortTasks(rows: Record<string, unknown>[]) {
  const byId = new Map(rows.map((r) => [r.id as string, r]));
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  const visit = (r: Record<string, unknown>) => {
    const id = r.id as string;
    if (seen.has(id)) return;
    const pid = r.parentId as string | null;
    if (pid && byId.has(pid)) visit(byId.get(pid)!);
    seen.add(id);
    out.push(r);
  };
  rows.forEach(visit);
  return out;
}

function tableExists(db: DatabaseSync, name: string): boolean {
  const r = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    )
    .get(name);
  return !!r;
}

async function main() {
  console.log(`Source: ${SQLITE_PATH}  →  Postgres (DATABASE_URL)`);
  if (DRY_RUN) console.log("DRY RUN — no writes.\n");
  // Read-only: safe with :ro mounts, never mutates the source. With the
  // -wal/-shm sidecar files present, this still reads the latest WAL data.
  const db = new DatabaseSync(SQLITE_PATH, { readOnly: true });

  // Warn if a non-empty WAL sits next to the DB but isn't readable here — its
  // rows would be missed. (Sidecar not present in a single-file container mount.)
  try {
    const wal = db
      .prepare("PRAGMA wal_checkpoint(PASSIVE)")
      .get() as { busy?: number; log?: number } | undefined;
    if (wal && typeof wal.log === "number" && wal.log > 0) {
      console.warn(
        `\n⚠  В WAL есть ${wal.log} страниц. Если данные неполные — сначала выполните:\n` +
          `   sqlite3 ${SQLITE_PATH} 'PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;'\n`,
      );
    }
  } catch {
    /* checkpoint unavailable on a read-only handle — ignore */
  }

  let total = 0;
  for (const model of ORDER) {
    if (!tableExists(db, model)) {
      console.log(`${model.padEnd(18)} — таблицы нет, пропуск`);
      continue;
    }
    const raw = db
      .prepare(`SELECT * FROM "${model}"`)
      .all() as Record<string, unknown>[];
    if (raw.length === 0) {
      console.log(`${model.padEnd(18)} 0`);
      continue;
    }
    const types = scalarTypes(model);
    let rows = raw.map((r) => convertRow(r, types));
    if (model === "Task") rows = sortTasks(rows);

    if (!DRY_RUN) {
      const delegate = model[0].toLowerCase() + model.slice(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any)[delegate].createMany({
        data: rows,
        skipDuplicates: true,
      });
    }
    total += rows.length;
    console.log(`${model.padEnd(18)} ${rows.length}`);
  }

  db.close();
  await prisma.$disconnect();
  console.log(`\nГотово. Всего строк: ${total}${DRY_RUN ? " (dry run)" : ""}.`);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
