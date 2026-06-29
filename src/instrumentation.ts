/**
 * Server instrumentation — runs once per Next.js server instance on boot.
 *
 * We use it to drive deadline reminders without depending on an external cron:
 * a periodic in-process tick calls `checkDeadlines()`, which notifies assignees
 * and creators about tasks due today/tomorrow or already overdue. The check is
 * idempotent per day (guarded by `Task.deadlineNotifiedAt`), so running it
 * hourly is safe — each task fires at most one reminder per calendar day.
 *
 * `/api/cron/deadlines` remains available for external schedulers (e.g. a
 * platform cron) if you prefer to drive it from outside the process.
 */
export async function register() {
  // Only run in the Node.js server runtime (not Edge, not the browser bundle).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // SQLite tuning — must run before traffic. Default journal mode makes a
  // writer block ALL readers, which shows up as the app intermittently
  // "freezing" while a background write (presence ping, deadline scheduler,
  // task move) holds the lock. WAL lets reads proceed during writes;
  // busy_timeout makes a query wait for a lock instead of erroring;
  // synchronous=NORMAL is the safe, fast pairing for WAL.
  try {
    const { prisma } = await import("./lib/prisma");
    await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;");
    await prisma.$queryRawUnsafe("PRAGMA synchronous=NORMAL;");
  } catch (err) {
    console.error("[sqlite] pragma init failed:", err);
  }

  // Opt-out hook for environments that drive the cron route externally.
  if (process.env.DISABLE_DEADLINE_SCHEDULER === "1") return;

  const HOUR = 60 * 60 * 1000;

  async function tick() {
    try {
      const { checkDeadlines } = await import("./lib/notify");
      await checkDeadlines();
    } catch (err) {
      console.error("[deadlines] scheduled check failed:", err);
    }
  }

  // First pass shortly after boot, then every hour.
  setTimeout(tick, 15_000);
  setInterval(tick, HOUR);
}
