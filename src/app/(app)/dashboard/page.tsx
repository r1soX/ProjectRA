import Link from "next/link";
import {
  ListTodo,
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  LayoutGrid,
  ListChecks,
  PartyPopper,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getUserBoards } from "@/lib/boards";
import {
  getMyWork,
  getOnboardingProgress,
  type MyTask,
} from "@/lib/dashboard";
import { hasPerm, PERMS } from "@/lib/permissions";
import { PRIORITY_META, normalizePriority } from "@/lib/priority";
import { PageContainer } from "@/components/ui/page-container";
import { EmptyState } from "@/components/ui/empty-state";
import { OnboardingChecklist } from "./onboarding-checklist";
import { cn } from "@/lib/cn";

function dueLabel(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
  });
}

const BUCKET_TEXT: Record<MyTask["bucket"], string> = {
  overdue: "text-red-400",
  today: "text-amber-400",
  upcoming: "text-neutral-400",
  none: "text-neutral-600",
};

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {label}
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold text-neutral-100">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const canBoards = await hasPerm(user.id, user.role, PERMS.BOARD_VIEW);
  const [{ tasks, stats }, boards, onboarding] = await Promise.all([
    getMyWork(user.id),
    canBoards ? getUserBoards(user.id) : Promise.resolve([]),
    getOnboardingProgress(user.id),
  ]);

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Привет, {user.firstName}! 👋
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          {stats.active === 0
            ? "На вас нет активных задач — отличный момент спланировать новое."
            : `На вас ${stats.active} активных задач${stats.overdue > 0 ? `, из них ${stats.overdue} просрочено` : ""}.`}
        </p>
      </div>

      {!onboarding.allDone && (
        <OnboardingChecklist steps={onboarding.steps} ownsBoard={onboarding.ownsBoard} />
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ListTodo} label="Активные" value={stats.active} tone="bg-sky-500/15 text-sky-300" />
        <StatCard icon={AlertTriangle} label="Просрочено" value={stats.overdue} tone="bg-red-500/15 text-red-300" />
        <StatCard icon={CalendarClock} label="Сегодня" value={stats.today} tone="bg-amber-500/15 text-amber-300" />
        <StatCard icon={CalendarRange} label="На неделе" value={stats.week} tone="bg-emerald-500/15 text-emerald-300" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* My tasks */}
        <section className="glass rounded-2xl p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-200">
            <ListChecks className="h-4 w-4 text-sky-400" />
            Мои задачи
          </h2>
          {tasks.length === 0 ? (
            <EmptyState
              icon={PartyPopper}
              title="Задач нет"
              description="Вам ничего не назначено. Создайте задачу через ⌘K или откройте доску."
              className="py-10"
            />
          ) : (
            <div className="space-y-1">
              {tasks.slice(0, 14).map((t) => {
                const pr = PRIORITY_META[normalizePriority(t.priority)];
                return (
                  <Link
                    key={t.id}
                    href={`/boards/${t.boardId}?task=${t.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.04]"
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", pr.dot)} />
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">
                      {t.title}
                    </span>
                    <span
                      className="hidden shrink-0 rounded px-2 py-0.5 text-xs text-neutral-300 sm:inline"
                      style={{ backgroundColor: t.boardColor + "22" }}
                    >
                      {t.boardTitle}
                    </span>
                    {t.dueDate && (
                      <span className={cn("shrink-0 text-xs", BUCKET_TEXT[t.bucket])}>
                        {t.bucket === "today" ? "сегодня" : dueLabel(t.dueDate)}
                      </span>
                    )}
                  </Link>
                );
              })}
              {tasks.length > 14 && (
                <p className="px-2 pt-1 text-xs text-neutral-600">
                  и ещё {tasks.length - 14}…
                </p>
              )}
            </div>
          )}
        </section>

        {/* Boards quick access */}
        <section className="glass h-fit rounded-2xl p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-200">
            <LayoutGrid className="h-4 w-4 text-indigo-400" />
            Доски
          </h2>
          {boards.length === 0 ? (
            <p className="text-sm text-neutral-500">Нет доступных досок.</p>
          ) : (
            <div className="space-y-1">
              {boards.slice(0, 8).map((b) => (
                <Link
                  key={b.id}
                  href={`/boards/${b.id}`}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-white/[0.04]"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: b.color ?? "#0ea5e9" }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">
                    {b.title}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-600">
                    {b._count.tasks}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
