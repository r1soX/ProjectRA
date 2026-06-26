import { requireUser } from "@/lib/auth";
import { PageContainer } from "@/components/ui/page-container";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-neutral-100">
        Привет, {user.firstName}! 👋
      </h1>
      <p className="mt-2 text-neutral-400">
        Это рабочее пространство Tandem. Доски, задачи и мессенджер появятся на
        следующих этапах.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Доски", desc: "Канбан с перетягиванием задач", soon: true },
          { title: "Мессенджер", desc: "Чат по доскам и личные сообщения", soon: true },
          { title: "Календарь", desc: "Задачи по срокам", soon: true },
        ].map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-neutral-100">{c.title}</h2>
              {c.soon && (
                <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                  скоро
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-neutral-500">{c.desc}</p>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
