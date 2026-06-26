import Link from "next/link";
import { LayoutGrid, MessageCircle, CalendarDays, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getUserBoards } from "@/lib/boards";
import { PageContainer } from "@/components/ui/page-container";

const cards = [
  {
    href: "/boards",
    title: "Доски",
    desc: "Канбан, задачи, исполнители и сроки",
    icon: LayoutGrid,
    accent: "from-sky-400 to-indigo-500",
  },
  {
    href: "/messages",
    title: "Мессенджер",
    desc: "Чат по доскам и личные сообщения",
    icon: MessageCircle,
    accent: "from-violet-400 to-fuchsia-500",
  },
  {
    href: "/calendar",
    title: "Календарь",
    desc: "Задачи по срокам, перенос дедлайнов",
    icon: CalendarDays,
    accent: "from-emerald-400 to-teal-500",
  },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const boards = await getUserBoards(user.id);

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Привет, {user.firstName}! 👋
        </h1>
        <p className="mt-2 text-neutral-400">
          Рабочее пространство{" "}
          <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text font-medium text-transparent">
            Projectra
          </span>
          {" — "}у вас {boards.length}{" "}
          {boards.length === 1 ? "доска" : "досок"} в работе.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="glass glass-hover group relative overflow-hidden rounded-2xl p-5 shadow-lg shadow-black/20 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/10"
          >
            <div className="flex items-start justify-between">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.accent} text-white shadow-lg`}
              >
                <c.icon className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-5 w-5 text-neutral-600 transition group-hover:text-neutral-300" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">{c.title}</h2>
            <p className="mt-1 text-sm text-neutral-400">{c.desc}</p>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
