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
