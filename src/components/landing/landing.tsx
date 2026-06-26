"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  MessageSquare,
  CalendarDays,
  Share2,
  ShieldCheck,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Aurora } from "@/components/visual/aurora";
import { MockBoard } from "@/components/visual/mock-board";

const features = [
  { icon: LayoutDashboard, title: "Доски с перетягиванием", text: "Канбан с drag & drop, колонками, исполнителями, сроками и метками." },
  { icon: MessageSquare, title: "Командный мессенджер", text: "Чат по доскам, личные сообщения и обсуждения прямо в задачах." },
  { icon: CalendarDays, title: "Календарь", text: "Все дедлайны команды в одном виде. Перенос задач прямо в календаре." },
  { icon: Share2, title: "Связи задач", text: "Визуальные линии зависимостей — наглядная карта всего проекта." },
  { icon: ShieldCheck, title: "Доступы и роли", text: "Гибкие права на доски. Регистрация — только через администратора." },
  { icon: Users, title: "Общие и личные таски", text: "Личное пространство и совместная работа команды в одном месте." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

export function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      <Aurora />

      <div className="relative z-10">
        {/* Nav */}
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-xl font-bold text-transparent">
            Projectra
          </span>
          <Link
            href="/login"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-neutral-200 backdrop-blur transition hover:bg-white/10"
          >
            Войти
          </Link>
        </header>

        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-12 pt-10 lg:grid-cols-2 lg:pt-20">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-sm text-sky-300"
            >
              <Sparkles className="h-4 w-4" />
              Новое поколение командной работы
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-6 text-5xl font-black tracking-tight md:text-6xl"
            >
              Все задачи команды —{" "}
              <span className="animate-gradient bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                в одном месте
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-6 max-w-xl text-lg leading-8 text-neutral-400"
            >
              Projectra объединяет доски, мессенджер, календарь и связи задач.
              Планируйте, обсуждайте и доводите проекты до конца — вместе.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-9 flex flex-wrap items-center gap-4"
            >
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400"
              >
                Войти в систему
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <span className="text-sm text-neutral-500">
                Регистрация доступна только через администратора
              </span>
            </motion.div>
          </div>

          {/* Hero visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="relative"
          >
            <div className="animate-float-slow">
              <MockBoard />
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              Всё для совместной работы
            </h2>
            <p className="mt-3 text-neutral-400">
              Один инструмент вместо десятка разрозненных сервисов
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition hover:-translate-y-1 hover:border-sky-500/40 hover:bg-white/[0.06]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-sky-300">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-7 text-neutral-400">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/10 to-indigo-500/10 px-8 py-14 text-center"
          >
            <Aurora grid={false} />
            <div className="relative z-10">
              <h2 className="text-3xl font-bold md:text-4xl">
                Готовы работать в связке?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-neutral-400">
                Войдите в рабочее пространство и соберите команду на одной доске.
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400"
              >
                Войти
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8 text-center text-sm text-neutral-600">
          Projectra © {new Date().getFullYear()} · Корпоративная система управления
          проектами
        </footer>
      </div>
    </main>
  );
}
