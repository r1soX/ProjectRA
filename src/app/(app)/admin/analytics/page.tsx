import {
  Users,
  LayoutGrid,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Plus,
  TrendingUp,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { hasPerm, PERMS } from "@/lib/permissions";
import { getWorkspaceAnalytics } from "@/lib/analytics";
import { PageContainer } from "@/components/ui/page-container";
import { AccessDenied } from "@/components/ui/access-denied";
import { getStatuses } from "@/lib/statuses";
import {
  PRIORITY_META,
  PRIORITIES,
  normalizePriority,
  type Priority,
} from "@/lib/priority";
import { cn } from "@/lib/cn";

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
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
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

function dayLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** Horizontal stacked distribution bar + legend (used for statuses/priorities). */
function Distribution({
  title,
  segments,
}: {
  title: string;
  segments: { key: string; label: string; color: string; count: number }[];
}) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  const present = segments.filter((s) => s.count > 0);
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">{title}</h2>
      {total === 0 ? (
        <p className="text-sm text-neutral-500">Нет данных.</p>
      ) : (
        <>
          <div className="mb-3 flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
            {present.map((s) => (
              <div
                key={s.key}
                style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
                title={`${s.label}: ${s.count}`}
              />
            ))}
          </div>
          <div className="space-y-1.5">
            {present.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="flex-1 text-neutral-300">{s.label}</span>
                <span className="font-medium text-neutral-200">{s.count}</span>
                <span className="w-9 text-right text-neutral-500">
                  {Math.round((s.count / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default async function AnalyticsPage() {
  const user = await requireAdmin();
  if (!(await hasPerm(user.id, user.role, PERMS.ADMIN_ANALYTICS_VIEW))) {
    return (
      <PageContainer>
        <AccessDenied message="У вас нет прав на просмотр аналитики." />
      </PageContainer>
    );
  }
  const a = await getWorkspaceAnalytics();
  const maxDay = Math.max(1, ...a.createdSeries.map((s) => s.count));
  const maxContrib = Math.max(1, ...a.topContributors.map((c) => c.completed));
  const maxLoad = Math.max(1, ...a.workload.map((c) => c.active));

  const statuses = await getStatuses();
  const statusMap = new Map(a.statusDistribution.map((s) => [s.status, s.count]));
  const statusSegments = statuses.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    count: statusMap.get(s.key) ?? 0,
  }));

  const prMap = new Map<string, number>();
  for (const p of a.priorityDistribution) {
    const k = normalizePriority(p.priority);
    prMap.set(k, (prMap.get(k) ?? 0) + p.count);
  }
  const prioritySegments = PRIORITIES.map((p: Priority) => ({
    key: p,
    label: PRIORITY_META[p].label,
    color: PRIORITY_META[p].bar,
    count: prMap.get(p) ?? 0,
  }));

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-100">Аналитика</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Подробная картина рабочего пространства.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={Users}
          label="Пользователи"
          value={a.users.total}
          sub={`${a.users.active7d} активны за неделю`}
          tone="bg-sky-500/15 text-sky-300"
        />
        <Kpi icon={LayoutGrid} label="Доски" value={a.boards} tone="bg-indigo-500/15 text-indigo-300" />
        <Kpi
          icon={ListTodo}
          label="Активные задачи"
          value={a.tasks.active}
          sub={`из ${a.tasks.total} всего`}
          tone="bg-amber-500/15 text-amber-300"
        />
        <Kpi
          icon={CheckCircle2}
          label="Завершено"
          value={a.tasks.completed}
          sub={`${a.completionRate}% от всех`}
          tone="bg-emerald-500/15 text-emerald-300"
        />
        <Kpi icon={AlertTriangle} label="Просрочено" value={a.tasks.overdue} tone="bg-red-500/15 text-red-300" />
        <Kpi
          icon={CalendarClock}
          label="Скоро дедлайн"
          value={a.tasks.soonDue}
          sub="в ближайшие 7 дней"
          tone="bg-orange-500/15 text-orange-300"
        />
        <Kpi icon={Plus} label="Создано / нед." value={a.createdThisWeek} tone="bg-violet-500/15 text-violet-300" />
        <Kpi
          icon={TrendingUp}
          label="Завершено / нед."
          value={a.completedThisWeek}
          tone="bg-teal-500/15 text-teal-300"
        />
      </div>

      {/* Distributions */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Distribution title="Задачи по статусам" segments={statusSegments} />
        <Distribution title="Задачи по приоритету" segments={prioritySegments} />
      </div>

      {/* Created series (14 days) */}
      <section className="glass mt-6 rounded-2xl p-5">
        <h2 className="mb-4 text-sm font-semibold text-neutral-200">
          Создано задач за 14 дней
        </h2>
        <div className="overflow-x-auto">
          <div className="flex h-40 min-w-[460px] items-end gap-1.5 sm:min-w-0">
            {a.createdSeries.map((s) => (
              <div key={s.date} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-sky-500/40 to-sky-400"
                    style={{ height: `${(s.count / maxDay) * 100}%`, minHeight: s.count ? 4 : 0 }}
                    title={`${s.date}: ${s.count}`}
                  />
                </div>
                <span className="text-[9px] text-neutral-500">{dayLabel(s.date)}</span>
                <span className="text-[10px] font-medium text-neutral-400">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Board stats */}
      <section className="glass mt-6 overflow-hidden rounded-2xl">
        <h2 className="border-b border-white/[0.06] px-5 py-3.5 text-sm font-semibold text-neutral-200">
          По доскам
        </h2>
        {a.boardStats.length === 0 ? (
          <p className="px-5 py-4 text-sm text-neutral-500">Нет досок.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="px-5 py-2 font-medium">Доска</th>
                  <th className="px-3 py-2 text-right font-medium">Всего</th>
                  <th className="px-3 py-2 text-right font-medium">Готово</th>
                  <th className="px-3 py-2 text-right font-medium">Просроч.</th>
                  <th className="px-5 py-2 font-medium">Прогресс</th>
                </tr>
              </thead>
              <tbody>
                {a.boardStats.map((b) => {
                  const pct = b.total ? Math.round((b.completed / b.total) * 100) : 0;
                  return (
                    <tr key={b.title} className="border-t border-white/[0.05]">
                      <td className="max-w-[16rem] truncate px-5 py-2.5 text-neutral-200">
                        {b.title}
                      </td>
                      <td className="px-3 py-2.5 text-right text-neutral-300">{b.total}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-300">{b.completed}</td>
                      <td className="px-3 py-2.5 text-right text-red-300">
                        {b.overdue || "—"}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs text-neutral-500">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* People */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RankSection
          title="Лидеры по выполнению"
          empty="Пока нет завершённых задач."
          rows={a.topContributors.map((c) => ({ name: c.name, value: c.completed }))}
          max={maxContrib}
          color="bg-emerald-500"
        />
        <RankSection
          title="Текущая загрузка (активные задачи)"
          empty="Нет активных задач."
          rows={a.workload.map((c) => ({ name: c.name, value: c.active }))}
          max={maxLoad}
          color="bg-amber-500"
        />
      </div>
    </PageContainer>
  );
}

function RankSection({
  title,
  empty,
  rows,
  max,
  color,
}: {
  title: string;
  empty: string;
  rows: { name: string; value: number }[];
  max: number;
  color: string;
}) {
  return (
    <section className="glass h-fit rounded-2xl p-5">
      <h2 className="mb-4 text-sm font-semibold text-neutral-200">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <div key={c.name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-neutral-200">{c.name}</span>
                <span className="text-neutral-500">{c.value}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full", color)}
                  style={{ width: `${(c.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
