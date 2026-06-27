import { redirect } from "next/navigation";
import {
  Users,
  LayoutGrid,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Clock,
  TrendingUp,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getWorkspaceAnalytics } from "@/lib/analytics";
import { PageContainer } from "@/components/ui/page-container";
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

function weekday(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "short" });
}

export default async function AnalyticsPage() {
  await requireAdmin();
  const a = await getWorkspaceAnalytics();
  const maxDay = Math.max(1, ...a.createdSeries.map((s) => s.count));
  const maxContrib = Math.max(1, ...a.topContributors.map((c) => c.completed));

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-100">Аналитика</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Ключевые метрики рабочего пространства.
        </p>
      </div>

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
        <Kpi icon={CheckCircle2} label="Завершено" value={a.tasks.completed} tone="bg-emerald-500/15 text-emerald-300" />
        <Kpi icon={AlertTriangle} label="Просрочено" value={a.tasks.overdue} tone="bg-red-500/15 text-red-300" />
        <Kpi icon={Plus} label="Создано за неделю" value={a.createdThisWeek} tone="bg-violet-500/15 text-violet-300" />
        <Kpi icon={Clock} label="Часов учтено" value={a.hoursLogged} tone="bg-cyan-500/15 text-cyan-300" />
        <Kpi
          icon={TrendingUp}
          label="Выполнено, %"
          value={a.tasks.total ? Math.round((a.tasks.completed / a.tasks.total) * 100) : 0}
          tone="bg-emerald-500/15 text-emerald-300"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Created series */}
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-200">
            Создано задач за 7 дней
          </h2>
          <div className="flex h-40 items-end gap-2">
            {a.createdSeries.map((s) => (
              <div key={s.date} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-sky-500/40 to-sky-400 transition-all"
                    style={{ height: `${(s.count / maxDay) * 100}%`, minHeight: s.count ? 4 : 0 }}
                    title={`${s.count}`}
                  />
                </div>
                <span className="text-[10px] text-neutral-500">{weekday(s.date)}</span>
                <span className="text-[10px] font-medium text-neutral-400">{s.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Top contributors */}
        <section className="glass h-fit rounded-2xl p-5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-200">
            Лидеры по выполнению
          </h2>
          {a.topContributors.length === 0 ? (
            <p className="text-sm text-neutral-500">Пока нет завершённых задач.</p>
          ) : (
            <div className="space-y-3">
              {a.topContributors.map((c) => (
                <div key={c.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-neutral-200">{c.name}</span>
                    <span className="text-neutral-500">{c.completed}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${(c.completed / maxContrib) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
