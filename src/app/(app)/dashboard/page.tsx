import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getUserBoards } from "@/lib/boards";
import { PageContainer } from "@/components/ui/page-container";

export default async function DashboardPage() {
  const user = await requireUser();
  const boards = await getUserBoards(user.id);

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-neutral-100">
        Привет, {user.firstName}! 👋
      </h1>
      <p className="mt-2 text-neutral-400">
        Рабочее пространство Projectra. Ваши доски и задачи — в одном месте.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/boards"
          className="group rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 transition hover:-translate-y-0.5 hover:border-sky-500/40 hover:bg-neutral-900/70"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-neutral-100">Доски</h2>
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">
              {boards.length}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-neutral-500">
            Канбан, задачи, исполнители и сроки
          </p>
        </Link>

        {[
          { title: "Мессенджер", desc: "Чат по доскам и личные сообщения" },
          { title: "Календарь", desc: "Задачи по срокам" },
        ].map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-neutral-100">{c.title}</h2>
              <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                скоро
              </span>
            </div>
            <p className="mt-1.5 text-sm text-neutral-500">{c.desc}</p>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
